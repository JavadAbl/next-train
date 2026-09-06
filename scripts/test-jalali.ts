import { toJalali, jalaliToDate, formatJalali } from "@/lib/jalali"
const fmt = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" })
let fails = 0
for (let i = 0; i < 400; i++) {
  const d = new Date(2023, 0, 1 + i * 3)
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
  const { jy, jm, jd } = toJalali(d)
  if (+parts.year !== jy || +parts.month !== jm || +parts.day !== jd) {
    console.log("MISMATCH", d.toDateString(), "intl:", parts.year, parts.month, parts.day, "ours:", jy, jm, jd)
    fails++
    if (fails > 5) break
  }
}
// round-trip check
const rt = jalaliToDate(1403, 5, 14)
const back = toJalali(rt)
console.log("roundtrip 1403/5/14 ->", back.jy, back.jm, back.jd, rt.toString())
console.log("format:", formatJalali(new Date()))
console.log(fails === 0 ? "ALL 400 SAMPLES OK" : `FAILED: ${fails}`)
