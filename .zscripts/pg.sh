#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Local user-space PostgreSQL manager (no root required)
# Binaries: .tools/ (portable zonky build — bin/initdb, bin/pg_ctl, bin/postgres)
# Data dir: .tools/pgdata  |  Port 5432 on 127.0.0.1 only
#
# Usage: .zscripts/pg.sh start|stop|status
# Called automatically by .zscripts/dev.sh when DATABASE_URL is local postgres.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLS="$PROJECT_DIR/.tools"
PGDATA="$TOOLS/pgdata"
PGLOG="$TOOLS/pg.log"
PGPORT=5432
PGUSER=train
PGPASSWORD_LOCAL=train_dev_pw
DBNAME=traindb

pg_running() {
	"$TOOLS/bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1
}

wait_ready() {
	for _ in $(seq 1 30); do
		if "$TOOLS/bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
			# probe TCP with bash /dev/tcp
			if (exec 3<>"/dev/tcp/127.0.0.1/$PGPORT") 2>/dev/null; then
				exec 3>&- 3<&- || true
				return 0
			fi
		fi
		sleep 1
	done
	return 1
}

case "${1:-}" in
start)
	if [ ! -x "$TOOLS/bin/postgres" ]; then
		echo "[pg] portable binaries not found in .tools — skipping local postgres"
		exit 0
	fi

	if pg_running; then
		echo "[pg] already running (port $PGPORT)"
		exit 0
	fi

	if [ ! -f "$PGDATA/PG_VERSION" ]; then
		echo "[pg] first run: initdb"
		echo "$PGPASSWORD_LOCAL" > "$TOOLS/.pw"
		"$TOOLS/bin/initdb" -D "$PGDATA" -U "$PGUSER" --pwfile="$TOOLS/.pw" \
			--auth-local=scram-sha-256 --auth-host=scram-sha-256 \
			--no-locale -E UTF8 >/dev/null
		rm -f "$TOOLS/.pw"
		# create the app database in single-user mode (no psql binary shipped)
		echo "CREATE DATABASE $DBNAME OWNER $PGUSER;" |
			"$TOOLS/bin/postgres" --single -D "$PGDATA" postgres >/dev/null 2>&1 || true
	fi

	echo "[pg] starting postgres on 127.0.0.1:$PGPORT"
	"$TOOLS/bin/pg_ctl" -D "$PGDATA" -l "$PGLOG" \
		-o "-p $PGPORT -h 127.0.0.1" -w -t 30 start >/dev/null
	if wait_ready; then
		echo "[pg] ready: postgresql://$PGUSER:***@127.0.0.1:$PGPORT/$DBNAME"
	else
		echo "[pg] ERROR: failed to become ready — see $PGLOG" >&2
		exit 1
	fi
	;;
stop)
	if pg_running; then
		"$TOOLS/bin/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null
		echo "[pg] stopped"
	else
		echo "[pg] not running"
	fi
	;;
status)
	if pg_running; then
		echo "[pg] running (port $PGPORT)"
	else
		echo "[pg] not running"
		exit 1
	fi
	;;
*)
	echo "usage: $0 start|stop|status" >&2
	exit 1
	;;
esac
