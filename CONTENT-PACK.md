# NikNote Content Pack

Publication-ready assets. Nothing in this file has been published — there are no
social accounts connected to this session, and creating accounts or posting on
the founder's behalf would be impersonation.

Everything here is designed around the **one thing that is genuinely watchable
about this product**: a plain paragraph of typed text becoming a page of
handwriting in front of the viewer. That transformation is the marketing.

---

## The format to bet on

A 30-second screen recording, no face, no voice-over needed:

| Second | On screen |
|---|---|
| 0–2 | Empty editor, typed text visible |
| 2–4 | Cursor picks a handwriting style |
| 4–12 | Text converts — **this is the hook, do not skip it** |
| 12–20 | Switch style again (proves it is not one fixed font) |
| 20–26 | Scroll the rendered page; show the ruled paper and ink |
| 26–30 | Export → PDF opens → end card |

Why this works: the viewer sees the result before hearing any claim. No
testimonial required, no trust required, no reading required.

**Do not** put a price, a logo intro, or a talking head in the first 3 seconds.

---

## Five ready scripts

### 1. The homework panic (highest intent)

**Hook (0–3s, on screen):** "Assignment kal submit hai, likhna baaki 😭"

**Beats:** Show empty page → paste the assignment question → convert → export.
End on the exported PDF.

**Caption:**
> Assignment deadline kal hai aur likhna baaki? 😅
> Typed text → handwritten page, 16 styles, 300 DPI print-ready PDF.
> Free to try, no signup: niknote.online
> #cbse #assignments #studyhacks #handwriting

**CTA:** "Link bio mein" (or direct link in the description on YouTube).
**Destination:** `https://www.niknote.online/?utm_source=instagram&utm_medium=reel&utm_campaign=assignment`
**Metric:** `landing_page_viewed` where `page_url` contains `utm_campaign=assignment`.

---

### 2. The teacher's Thursday night

**Hook:** "Teacher ho to Thursday raat ka matlab pata hai 🥲"

**Beats:** Show 30 questions typed → one click → handwritten worksheet →
print preview. Say the line: "30 questions, 2 minute. Pehle 40 minute lagte the."

**Caption:**
> Worksheet banane mein poora evening nikal jaata hai?
> 30 questions → handwritten worksheet → print. ~2 minute.
> Teachers ke liye ₹999/saal, 30 din free pilot: niknote.online/schools
> #teacherlife #teachersofindia #coachingclasses

**Destination:** `https://www.niknote.online/schools?utm_source=instagram&utm_medium=reel&utm_campaign=teacher`
**Metric:** `pricing_viewed`, then `sales_leads` rows with `segment='teacher'`.

---

### 3. Style roulette

**Hook:** "Ek hi paragraph, 6 alag handwriting 👀"

**Beats:** Convert the same paragraph six times, six styles, fast cuts (1.5s
each). No text overlay, no music needed beyond a beat.

**Caption:**
> Same paragraph. Six handwriting styles. Kaunsi sabse real lagti hai? 👇
> Free try: niknote.online
> #handwriting #notes #studytok

**Destination:** `?utm_source=instagram&utm_medium=reel&utm_campaign=styles`
**Metric:** `landing_page_viewed` + `first_note_created` (activation, not just traffic).

---

### 4. Side-by-side reality check

**Hook:** "Asli haath se likha vs NikNote — pehchano 🔍"

**Beats:** Split screen. Left: a real handwritten page (photograph one). Right:
generated. Hold 4 seconds. Then reveal which is which.

**Why this one matters:** it is honest, it is genuinely engaging, and it
pre-empts the "yeh fake lagta hai" objection instead of dodging it.

**Caption:**
> Left ya right — kaunsi asli hai? 🤔
> Dono dekh ke batao comments mein.
> #handwriting #reels #study

---

### 5. The PDF studio angle (non-student audience)

**Hook:** "Scanned PDF ka text edit karna hai? Browser mein ho jayega."

**Beats:** Open a scanned PDF → edit text in place → sign → download.

**Caption:**
> PDF edit karne ke liye software install karne ki zaroorat nahi.
> Merge, split, compress, OCR, e-sign — sab browser mein, file upload ke bina.
> niknote.online/pdf-tools
> #pdf #productivity #office

**Destination:** `?utm_source=instagram&utm_medium=reel&utm_campaign=pdf`
**Why include it:** teachers and office workers search for this far more than
students search for handwriting. Different audience, same tool.

---

## WhatsApp — the highest-conversion channel you already own

Send to classmates, not to strangers. One message, no mass-blast.

> bhai ye try kar — text daalo, handwriting mein page ban jaata hai, PDF milta hai
> assignment ke liye kaam aaya https://www.niknote.online/?utm_source=whatsapp&utm_medium=share
> free hai, login bhi nahi karna

Rules: send it to people you actually know, one at a time, and stop if they do
not reply. Bulk forwarding is how a product gets reported as spam.

---

## Quora / Reddit — answer first, mention second

These communities ban self-promotion and detect it easily. The only viable
approach is to be genuinely useful and mention the tool only when it is
literally the answer.

**Where the question already exists:** search Quora for
"text to handwriting converter", "assignment handwritten kaise likhe",
"CBSE project file handwriting", "handwriting font for assignment".

**Answer skeleton (do not paste verbatim):**

> Teen options hain, aur teeno ka apna use case hai:
>
> 1. **Hand se likhna** — best for anything a teacher might inspect closely.
> 2. **Font install karke Word mein type karna** — sasta but har page ek jaisa
>    dikhta hai, aur font hi repeat hota hai.
> 3. **Text-to-handwriting converter** — paragraph paste karo, page render hota
>    hai, PDF milta hai. 10-15 page ke project file ke liye sabse practical.
>
> Main NikNote banata hoon (option 3), isliye mera opinion biased hai — but
> free tier mein try karke khud dekh lo, aur agar koi aur tool behtar lage to
> wahi use karo.
>
> Ek cheez zaroor dhyan rakhna: submitted assignment apne haath se likha hua
> hona chahiye jahan teacher verify kare. Yeh tools practice sheets, rough
> work, aur project files ke liye hain.

That last paragraph is not a disclaimer — it is the reason the answer will
survive moderation and be trusted.

---

## UTM scheme (use these exactly)

The analytics now capture `page_url` including the query string, so UTMs are
what make `channel_performance` meaningful.

```
?utm_source=<instagram|youtube|whatsapp|quora|reddit|linkedin>
&utm_medium=<reel|short|share|answer|post>
&utm_campaign=<assignment|teacher|styles|pdf|launch>
```

Read the results with:

```sql
select referrer_channel, views, payments
from channel_performance
order by payments desc, views desc;

select * from acquisition_funnel_daily order by day desc limit 14;
```

---

## Publishing checklist before the first post

- [ ] Account created and owned by you (never automated, never shared)
- [ ] Link in bio points to `niknote.online` with the UTM above
- [ ] One screen recording per script — no editing beyond trimming
- [ ] Post 3 reels before judging the channel; one post tells you nothing
- [ ] After 14 days and 9 posts, check `channel_performance`

**Kill criteria:** if 9 posts produce under 100 `landing_page_viewed` events
total, the content or the channel is wrong. Change the hook before posting more.

---

## What will not work, and should not be attempted

- Buying followers, views, or engagement — platforms detect it and the account
  gets limited before it ever gets reach.
- Fake reviews on the site or Play Store. The site's fabricated testimonials were
  removed in the previous session for exactly this reason.
- Automated DMs to students. It gets accounts banned and is a reporting offence.
- Bulk email to schools scraped from directories without consent.
- Claiming AI features work while `GEMINI_API_KEY` is still unset — the deploy
  returns `503 provider_not_configured`.
