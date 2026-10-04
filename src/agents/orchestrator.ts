// ============================================================
// NikNote 4.0 — AI Agent Orchestrator V3
// MASSIVE local knowledge + Smart template engine + API backend
// Works WITHOUT API key (200+ topics) + WITH API key (unlimited)
// ============================================================

import { supabase } from '@/integrations/supabase/client';

// Agent types
export type AgentType =
  | 'teacher' | 'notes' | 'research' | 'diagram' | 'revision'
  | 'quiz' | 'assignment' | 'doubt' | 'productivity' | 'handwriting' | 'document';

export interface AgentMessage { role: 'system' | 'user' | 'assistant'; content: string; agent?: AgentType; }
export interface AgentResponse { content: string; agent: AgentType; suggestions?: string[]; actions?: AgentAction[]; flashcards?: Flashcard[]; quiz?: QuizQuestion[]; mindMap?: MindMapNode; }
export interface AgentAction { type: string; label: string; icon: string; data?: any; }
export interface Flashcard { front: string; back: string; difficulty: 'easy' | 'medium' | 'hard'; }
export interface QuizQuestion { question: string; options: string[]; correctIndex: number; explanation: string; difficulty: 'easy' | 'medium' | 'hard'; }
export interface MindMapNode { topic: string; children: MindMapNode[]; keywords?: string[]; }

// ============================================================
// MASSIVE LOCAL KNOWLEDGE BASE — 50+ Topics for Indian Students
// Works INSTANTLY without any API key
// ============================================================

interface KnowledgeEntry {
  keywords: string[];
  agent: AgentType;
  answer: string;
  formulas?: string[];
  examTips?: string[];
  commonMistakes?: string[];
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ===== PHYSICS =====
  {
    keywords: ['newton', 'law of motion', 'gati ke niyam', 'motion ke niyam'],
    agent: 'teacher',
    answer: `## 🍎 Newton's Laws of Motion

**Hook:** Jab bus mein achanak brake lagata hai, tum aage gir jaate ho — Newton ka pehla law!

**Simple:** Newton ne 3 laws diye jo batate hain ki cheezein kaise move karti hain.

### 🟢 Beginner Level:
- **1st Law (Inertia):** Jab tak koi bahari force na lage, cheez apni state nahi badlegi. Bus mein brake se tum aage — body rest pe rehna chahti thi!
- **2nd Law (F=ma):** Jitna zyada force, utna zyada acceleration. Cricket ball ko jitna zor se maaro, utni door jaayegi.
- **3rd Law (Action-Reaction):** Har action ka equal opposite reaction. Tum wall ko dhakka → wall tumhe dhakka!

### 🟡 Intermediate Level:
- **1st Law:** यदि किसी वस्तु पर बाह्य बल शून्य है, तो वस्तु अपनी विराम या एकसमान गति की अवस्था में रहती है
- **2nd Law:** बल = द्रव्यमान × त्वरण (F = ma)
- **3rd Law:** प्रत्येक क्रिया की समान और विपरीत दिशा में प्रतिक्रिया होती है

### 🔴 Exam-Focused:
- **2-mark:** State Newton's 2nd law → F = dp/dt = ma
- **5-mark:** Derive F=ma from momentum: p=mv → dp/dt = m(dv/dt) = ma → F=ma
- **Numerical:** 5kg object at 3m/s² → F = 5×3 = 15N`,
    formulas: ['F = ma', 'F = dp/dt', 'p = mv', 'F₁₂ = -F₂₁'],
    examTips: ['Newton 2nd law ko momentum se derive karna — most asked!', 'Action-reaction DIFFERENT bodies pe act karte hain — same body pe nahi'],
    commonMistakes: ['Action-reaction same body pe act karte hain — WRONG! Different bodies pe act karte hain', 'F=ma mein "a" net acceleration hai, kisi ek force ka nahi']
  },
  {
    keywords: ['photosynthesis', 'prakash sanshleshan', 'plant ka khana', 'plant food'],
    agent: 'teacher',
    answer: `## 🌿 Photosynthesis — Plant ka Khana Banana!

**Hook:** Agar plants khana nahi banaate, toh duniya mein oxygen hi nahi hoti — aur hum nahi jeete!

**Simple:** Plants sunlight ka use karke CO₂ + H₂O se glucose banate hain. Isme O₂ nikalti hai.

### 🟢 Beginner:
- **Word Equation:** Carbon Dioxide + Water + Sunlight → Glucose + Oxygen
- **Analogy:** Plant = Solar factory! Sunlight = bijli, CO₂ = raw material, Glucose = product, O₂ = waste (humke kaam ki!)

### 🟡 Intermediate:
- **Chemical Equation:** 6CO₂ + 6H₂O →(Sunlight/Chlorophyll)→ C₆H₁₂O₆ + 6O₂
- **Two Stages:**
  1. **Light Reaction** (Thylakoid): Sunlight → ATP + NADPH + O₂
  2. **Dark Reaction/Calvin Cycle** (Stroma): CO₂ + ATP + NADPH → Glucose

### 🔴 Exam-Focused:
- **5-mark:** Explain light reaction with diagram of thylakoid
- **3-mark:** Difference between light & dark reaction (table format)
- **2-mark:** Role of chlorophyll — absorbs light energy (green light reflects, that's why leaves appear green)`,
    formulas: ['6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂'],
    examTips: ['"Dark reaction" ke bajaye "Light independent reaction" likho — examiners prefer this', 'Always mention chlorophyll as catalyst, not reactant'],
    commonMistakes: ['"Dark reaction sirf andhere mein hota hai" — WRONG! Light ki zaroorat nahi but ho sakta hai light mein bhi', 'O₂ glucose se nahi aata — O₂ water (H₂O) se aata hai!']
  },
  {
    keywords: ['pythagoras', 'pythagorean theorem', 'a²+b²=c²', 'hypotenuse'],
    agent: 'teacher',
    answer: `## 📐 Pythagoras Theorem

**Hook:** Builders aur architects is theorem ko daily use karte hain — bina iske koi building seedha nahi khada hota!

### Formula: **a² + b² = c²** (c = hypotenuse = longest side)

### 🟢 Beginner:
- Right angle ke opposite wali side = hypotenuse (longest)
- Example: 3-4-5 triangle: 9 + 16 = 25 ✅
- Ladder 13m, wall se 5m door → Wall ki unchai = √(169-25) = √144 = 12m

### 🟡 Intermediate:
- **Converse:** If a² + b² = c², toh triangle right-angled hai
- **Applications:** Distance formula, finding heights, navigation
- **Proof methods:** Area method, Similar triangles, Bhaskara's proof

### 🔴 Exam:
- **5-mark:** Prove using similarity of triangles
- **3-mark:** Numerical: Find diagonal of rectangle (l=8, b=6) → √(64+36) = 10
- **Application:** Ladder problems, shadow problems, distance between two points`,
    formulas: ['a² + b² = c²', 'c = √(a² + b²)', 'd = √(l² + b²)'],
    examTips: ['Always identify hypotenuse FIRST — it\'s always the longest side', 'Square root lena mat bhoolna end mein!'],
    commonMistakes: ['Hypotenuse ko galt identify karna — always opposite to right angle', 'Square root lena bhool jaana — c² nahi, c chahiye']
  },
  {
    keywords: ['thermodynamics', 'garmi vidhi', 'energy conservation', 'entropy', 'carnot'],
    agent: 'teacher',
    answer: `## 🌡️ Thermodynamics

**Hook:** Chai garam rakhne ke liye thermos — woh thermodynamics ka application hai!

### Key Laws:
1. **1st Law (Energy Conservation):** Energy create ya destroy nahi hoti — bas convert hoti hai. Electrical → Heat (heater)
2. **2nd Law (Entropy):** Heat spontaneously hot → cold flow karti hai, never reverse. Chai thandi hoti hai, garam nahi!
3. **3rd Law:** Absolute zero (0K = -273.15°C) achieve impossible hai

### Important Formulas:
- ΔU = Q - W (1st Law: Internal energy change = Heat added - Work done)
- η = 1 - T₂/T₁ (Carnot efficiency)
- ΔS = Q/T (Entropy change)

### Sign Convention:
- Q positive = Heat IN | Q negative = Heat OUT
- W positive = Work BY system | W negative = Work ON system`,
    formulas: ['ΔU = Q - W', 'η = 1 - T₂/T₁', 'ΔS = Q/T', 'W = PΔV'],
    examTips: ['Sign convention se 90% students galat karte hain — Q positive = heat IN', 'Carnot engine IDEAL hai — real engines always less efficient'],
    commonMistakes: ['Sign convention ulta use karna', 'Carnot efficiency real engine ka nahi hota — it\'s MAXIMUM theoretical']
  },
  {
    keywords: ['gravity', 'gravitation', 'gurutvakarshan', 'free fall', 'bhari padna'],
    agent: 'teacher',
    answer: `## 🌍 Gravitation

**Hook:** Apple neeche kyu girta hai? Newton ne yahi sawaal pucha tha!

### Key Concepts:
- **Newton's Law of Gravitation:** F = G(m₁m₂)/r²
- **Acceleration due to gravity:** g = 9.8 m/s² ≈ 10 m/s²
- **Free fall:** Jab sirf gravity ka force ho, koi air resistance nahi

### Formulas:
- F = Gm₁m₂/r² (G = 6.674 × 10⁻¹¹ Nm²/kg²)
- g = GM/R² (Earth surface pe)
- v = u + gt (free fall mein)
- h = ut + ½gt²
- v² = u² + 2gh

### 🟡 Key Points:
- g ki value poles pe zyada hai, equator pe kam (Earth oblate hai)
- g height badhne se kam hota hai, depth badhne se bhi kam hota hai
- Weight = mg (mass same rehta hai, weight change hota hai)

### 🔴 Exam:
- **5-mark:** Derive g = GM/R²
- **3-mark:** Difference between mass and weight (table)
- **2-mark:** Why g is less on moon? (M/R² is less)`,
    formulas: ['F = Gm₁m₂/r²', 'g = GM/R²', 'v² = u² + 2gh', 'h = ut + ½gt²', 'W = mg'],
    examTips: ['g = 10 m/s² use karo calculations mein (unless 9.8 specified)', 'Mass ≠ Weight — mass constant hai, weight g pe depend karta hai'],
    commonMistakes: ['Mass and weight ko same samajhna', 'g = G — WRONG! g = GM/R²']
  },
  {
    keywords: ['electricity', 'current', 'voltage', 'ohm', 'resistance', 'kiran', 'vidyut'],
    agent: 'teacher',
    answer: `## ⚡ Electricity — Current, Voltage & Resistance

**Hook:** Jab switch on karte ho, bulb jal uttha hai — lekin electricity kaise aati hai?

### Ohm's Law: **V = IR**
- V = Voltage (Volt) — Pressure jo current push karta hai
- I = Current (Ampere) — Flow of charge
- R = Resistance (Ohm Ω) — Opposition to flow

### Key Formulas:
- V = IR
- P = VI = I²R = V²/R (Power)
- R = ρL/A (Resistance of wire)
- Series: R_total = R₁ + R₂ + R₃
- Parallel: 1/R_total = 1/R₁ + 1/R₂ + 1/R₃

### 🟢 Beginner Analogy:
- Voltage = Paani ki tank ki unchai (pressure)
- Current = Paani ka flow (pipe mein)
- Resistance = Pipe ki narrowness (zyada narrow = zyada resistance)

### 🔴 Exam:
- **5-mark:** Derive series/parallel resistance formulas
- **3-mark:** Numerical: 3 resistors (2Ω, 4Ω, 6Ω) in parallel → 1/R = 1/2+1/4+1/6
- **2-mark:** Why do we use parallel circuits at home? (Each appliance gets same voltage)`,
    formulas: ['V = IR', 'P = VI', 'R = ρL/A', 'R_series = R₁+R₂+R₃', '1/R_parallel = 1/R₁+1/R₂+1/R₃'],
    examTips: ['Parallel circuit mein voltage SAME hota hai across each branch', 'Home circuits are parallel — not series!'],
    commonMistakes: ['Parallel mein resistances add nahi hote — reciprocal formula use karo', 'Power = VI, not just V or I']
  },
  {
    keywords: ['cell', 'koshika', 'mitosis', 'meiosis', 'cell division', 'organelle'],
    agent: 'teacher',
    answer: `## 🔬 Cell — The Building Block of Life

**Hook:** Tumhare body mein 37 TRILLION cells hain — aur sab ek hi cell se bane hain!

### Cell Structure:
| Part | Function |
|------|----------|
| Nucleus | Brain of cell, DNA stored here |
| Mitochondria | Powerhouse, ATP banata hai |
| Ribosome | Protein factory |
| Cell Membrane | Gatekeeper, selectivity permeable |
| Chloroplast | Only in plant cells, photosynthesis |
| Cell Wall | Only in plant cells, rigid structure |

### Cell Division:
- **Mitosis:** 1 cell → 2 identical cells (growth, repair)
- **Meiosis:** 1 cell → 4 different cells (gamete formation, halves chromosomes)

### Plant vs Animal Cell:
| Feature | Plant Cell | Animal Cell |
|---------|-----------|-------------|
| Cell Wall | ✅ Present | ❌ Absent |
| Chloroplast | ✅ Present | ❌ Absent |
| Vacuole | Large | Small |
| Centrioles | ❌ Absent | ✅ Present |`,
    formulas: ['Mitosis: 2n → 2n (diploid)', 'Meiosis: 2n → n (haploid)'],
    examTips: ['Plant vs Animal cell comparison table — ALWAYS asked!', 'Mitosis vs Meiosis — at least 4 differences'],
    commonMistakes: ['Centrioles plant cells mein nahi hote — exam mein likhna mat bhoolna', 'Meiosis mein chromosomes HALF hote jaate hain — not same']
  },
  {
    keywords: ['periodic table', 'element', 'trend', 'atomic number', 'group', 'period'],
    agent: 'teacher',
    answer: `## ⚗️ Periodic Table — Elements ka Map!

**Hook:** 118 elements ko yaad karna mushkil hai? Periodic table ek MAP hai — ek baar samjho, hamesha yaad rakhoge!

### Key Trends:
| Trend | Left → Right | Top → Bottom |
|-------|-------------|-------------|
| Atomic Radius | ↓ Decreases | ↑ Increases |
| Ionization Energy | ↑ Increases | ↓ Decreases |
| Electronegativity | ↑ Increases | ↓ Decreases |
| Metallic Character | ↓ Decreases | ↑ Increases |

### Important Groups:
- **Group 1 (Alkali Metals):** Li, Na, K — Very reactive, stored in oil
- **Group 2 (Alkaline Earth):** Be, Mg, Ca — Less reactive than G1
- **Group 17 (Halogens):** F, Cl, Br — Very reactive non-metals
- **Group 18 (Noble Gases):** He, Ne, Ar — Unreactive, stable
- **Transition Metals:** Fe, Cu, Zn — Form colored compounds

### Memory Tricks:
- **Group 1:** "LiNa Ki Ruby Cesium Friendship" (Li, Na, K, Rb, Cs, Fr)
- **Group 17:** "Fir Call kar Bhai Ise" (F, Cl, Br, I, At)`,
    formulas: ['Effective nuclear charge: Z_eff = Z - σ'],
    examTips: ['Periodic trends ka reason samjho — nuclear charge + shielding effect', 'Group 1 + water = violent reaction — always mention this in exam'],
    commonMistakes: ['Atomic radius increases down group — but decreases across period. Don\'t mix up!', 'Noble gases are NOT reactive — they have complete octet']
  },
  {
    keywords: ['trigonometry', 'sin', 'cos', 'tan', 'sine', 'cosine', 'trikonmiti'],
    agent: 'teacher',
    answer: `## 📐 Trigonometry — Angles aur Ratios

**Hook:** Agar tujhe pata hai tree ka angle aur distance, toh tree ki height nikal sakte ho — bina tree pe charhe!

### Basic Ratios (Right Triangle):
- **sin θ** = Perpendicular / Hypotenuse = P/H
- **cos θ** = Base / Hypotenuse = B/H
- **tan θ** = Perpendicular / Base = P/H

### Memory Trick: **"Some People Have Curly Brown Hair Through Proper Brushing"**
sin = P/H, cos = B/H, tan = P/B, cosec = H/P, sec = H/B, cot = B/P

### Common Angles Table:
| Angle | 0° | 30° | 45° | 60° | 90° |
|-------|----|----|----|----|-----|
| sin | 0 | 1/2 | 1/√2 | √3/2 | 1 |
| cos | 1 | √3/2 | 1/√2 | 1/2 | 0 |
| tan | 0 | 1/√3 | 1 | √3 | ∞ |

### Key Identities:
- sin²θ + cos²θ = 1
- 1 + tan²θ = sec²θ
- 1 + cot²θ = cosec²θ`,
    formulas: ['sin²θ + cos²θ = 1', 'tan θ = sin θ / cos θ', 'sin(A+B) = sinAcosB + cosAsinB'],
    examTips: ['30-60-90 aur 45-45-90 triangles ke ratios yaad rakhho', 'Identities prove karne mein LHS = RHS approach use karo'],
    commonMistakes: ['sin²θ ka matlab hai (sin θ)², NOT sin(θ²)', 'tan 90° defined nahi hai — infinity hai']
  },
  {
    keywords: ['quadratic', 'equation', 'ax²+bx+c', 'discriminant', 'dharatmak'],
    agent: 'teacher',
    answer: `## 📊 Quadratic Equations

**Hook:** Cricket ball ka trajectory ek quadratic curve hai — isliye ye itna important hai!

### Standard Form: **ax² + bx + c = 0** (a ≠ 0)

### Quadratic Formula:
**x = (-b ± √(b²-4ac)) / 2a**

### Discriminant: D = b² - 4ac
- **D > 0** → Two distinct real roots ✌️
- **D = 0** → Two equal real roots (one root repeated) ✋
- **D < 0** → No real roots (imaginary) ❌

### Methods to Solve:
1. **Factorization:** x²+5x+6 = (x+2)(x+3) = 0 → x = -2, -3
2. **Quadratic Formula:** Always works!
3. **Completing the Square:** ax²+bx+c → a(x+b/2a)² = ...

### Sum & Product of Roots:
- α + β = -b/a
- α × β = c/a`,
    formulas: ['x = (-b ± √(b²-4ac)) / 2a', 'D = b² - 4ac', 'α + β = -b/a', 'αβ = c/a'],
    examTips: ['Pehle discriminant check karo — roots real hain ya nahi', 'Word problems mein "find two numbers" → quadratic banao'],
    commonMistakes: ['a=0 ho toh quadratic nahi — linear equation hai', '± sign dono roots ke liye — ek positive, ek negative']
  },
  {
    keywords: ['probability', 'sambhavana', 'chance', 'random', 'event'],
    agent: 'teacher',
    answer: `## 🎲 Probability — Chance ka Game!

**Hook:** Toss karo coin — heads ya tails? Probability bataata hai kitna chance hai!

### Basic Formula:
**P(A) = Number of favorable outcomes / Total outcomes**

### Key Rules:
- 0 ≤ P(A) ≤ 1 (always between 0 and 1)
- P(sure event) = 1, P(impossible event) = 0
- P(A) + P(not A) = 1

### Types of Events:
- **Independent:** Ek event doosre ko affect nahi karta (2 dice roll)
- **Mutually Exclusive:** Dono ek saath nahi ho sakte (coin pe head & tail together? No!)
- **Complementary:** P(not A) = 1 - P(A)

### Important Formulas:
- P(A ∪ B) = P(A) + P(B) - P(A ∩ B)
- P(A ∩ B) = P(A) × P(B) [if independent]
- P(A|B) = P(A ∩ B) / P(B) [conditional]`,
    formulas: ['P(A) = n(A)/n(S)', 'P(A∪B) = P(A) + P(B) - P(A∩B)', 'P(A|B) = P(A∩B)/P(B)'],
    examTips: ['Dice = 6 outcomes, Coin = 2 outcomes, Deck of cards = 52', 'P(even number on dice) = 3/6 = 1/2'],
    commonMistakes: ['P(A∩B) = P(A)×P(B) SIRF independent events ke liye hai', 'Total probability must be 1 — check karo end mein']
  },
  {
    keywords: ['chemistry', 'reaction', 'chemical', 'balancing', 'rasayan'],
    agent: 'teacher',
    answer: `## ⚗️ Chemical Reactions & Equations

**Hook:** Iron pe lagta hai zang — woh ek chemical reaction hai! Rusting = Iron + Oxygen + Moisture

### Types of Reactions:
1. **Combination:** A + B → AB (2H₂ + O₂ → 2H₂O)
2. **Decomposition:** AB → A + B (2H₂O → 2H₂ + O₂)
3. **Displacement:** A + BC → AC + B (Fe + CuSO₄ → FeSO₄ + Cu)
4. **Double Displacement:** AB + CD → AD + CB (NaCl + AgNO₃ → AgCl + NaNO₃)
5. **Oxidation-Reduction (Redox):** Electron transfer

### Balancing Steps:
1. Write unbalanced equation
2. Count atoms each side
3. Balance one element at a time
4. Check: H and O last
5. Verify total atoms equal

### Indicators of Reaction:
- Color change 🔴→🔵
- Gas evolution (bubbles) 💨
- Precipitate formation (solid) ⬇️
- Temperature change 🌡️`,
    formulas: ['Law of Conservation of Mass: Mass of reactants = Mass of products'],
    examTips: ['Balancing mein H aur O ko LAST mein balance karo', 'Redox mein oxidation number change check karo'],
    commonMistakes: ['Coefficients change karo, subscripts nahi!', 'Diatomic molecules (H₂, O₂, N₂, Cl₂) yaad rakhho']
  },
  {
    keywords: ['algebra', 'equation', 'linear', 'variable', 'samikaran'],
    agent: 'teacher',
    answer: `## 🔢 Algebra — Variables ka Khel!

**Hook:** "x" kya hai? Ek aisi cheez jiski value hume nahi pata — lekin hum find kar sakte hain!

### Linear Equation (One Variable):
**ax + b = 0** → x = -b/a
Example: 2x + 6 = 0 → x = -3

### Linear Equation (Two Variables):
**ax + by = c** → Infinite solutions (line)
Two equations → Unique solution (point of intersection)

### Methods to Solve:
1. **Substitution:** ek variable ki value doosre mein daalo
2. **Elimination:** ek variable hatao by adding/subtracting
3. **Cross Multiplication:** formula use karo

### Key Identities:
- (a+b)² = a² + 2ab + b²
- (a-b)² = a² - 2ab + b²
- a² - b² = (a+b)(a-b)
- (a+b)³ = a³ + 3a²b + 3ab² + b³`,
    formulas: ['(a+b)² = a² + 2ab + b²', '(a-b)² = a² - 2ab + b²', 'a² - b² = (a+b)(a-b)', '(a+b+c)² = a²+b²+c²+2ab+2bc+2ca'],
    examTips: ['Identities directly use karo — expand mat karo unnecessarily', 'Word problem → variable define karo pehle'],
    commonMistakes: ['(a+b)² ≠ a² + b² — 2ab term miss mat karo!', 'Sign errors — especially with negative numbers']
  },
  {
    keywords: ['biology', 'digestion', 'food', 'nutrition', 'pachan'],
    agent: 'teacher',
    answer: `## 🍽️ Nutrition & Digestion

**Hook:** Khana khane ke baad energy kahan se aati hai? Digestion — breakdown of food into absorbable forms!

### Types of Nutrition:
- **Autotrophic:** Plants make their own food (photosynthesis)
- **Heterotrophic:** Animals eat others (we can't make food)

### Human Digestive System:
1. **Mouth** → Saliva (amylase) breaks starch → chewing
2. **Esophagus** → Food pipe, peristalsis pushes food
3. **Stomach** → HCl + Pepsin → protein digestion, kills bacteria
4. **Small Intestine** → MAIN digestion! Bile + pancreatic juice
5. **Large Intestine** → Water absorption
6. **Anus** → Waste removal

### Enzymes:
| Enzyme | Acts On | Product |
|--------|---------|---------|
| Amylase | Starch | Maltose |
| Pepsin | Proteins | Peptides |
| Lipase | Fats | Fatty acids + Glycerol |
| Trypsin | Proteins | Amino acids |`,
    formulas: [],
    examTips: ['Small intestine = longest part, MAIN site of digestion + absorption', 'Villi increase surface area for absorption'],
    commonMistakes: ['Bile is NOT an enzyme — it emulsifies fat only', 'Digestion starts in mouth, NOT stomach']
  },
  {
    keywords: ['magnet', 'magnetic', 'electromagnetic', 'chumbak', 'induction'],
    agent: 'teacher',
    answer: `## 🧲 Magnetism & Electromagnetic Induction

**Hook:** Fridge pe magnet kaise chipakta hai? Magnetic force — invisible but powerful!

### Key Concepts:
- **Magnetic Field:** Area around magnet where force acts
- **Field Lines:** North → South outside magnet
- **Electromagnet:** Current in coil = magnet (temporary)

### Faraday's Law:
**Changing magnetic flux → EMF induced**
EMF = -dΦ/dt (Φ = magnetic flux = BA cosθ)

### Lenz's Law:
Induced current opposes the change that caused it (conservation of energy)

### Right Hand Rules:
- **Fleming's Left Hand:** Motor effect (current + magnetic field → force)
- **Fleming's Right Hand:** Generator effect (motion + magnetic field → current)

### Applications:
- Electric motor (Left hand rule)
- Generator (Right hand rule)
- Transformer (mutual induction)`,
    formulas: ['EMF = -dΦ/dt', 'Φ = BA cosθ', 'F = BIL sinθ', 'Transformer: Vp/Vs = Np/Ns'],
    examTips: ['Left hand = Motor (M for Motor, M for Middle finger = Current)', 'Right hand = Generator (G for Generator, G for Government = Right)'],
    commonMistakes: ['Fleming\'s Left hand for MOTORS, Right hand for GENERATORS — don\'t mix!', 'Lenz\'s law opposes CHANGE — not the flux itself']
  },
  {
    keywords: ['light', 'reflection', 'refraction', 'prism', 'lens', 'mirror', 'prakash'],
    agent: 'teacher',
    answer: `## 💡 Light — Reflection & Refraction

**Hook:** Straw water mein tilted dikhta hai — refraction ki wajah se! Light direction change karta hai!

### Reflection:
- **Law:** Angle of incidence = Angle of reflection (i = r)
- **Concave mirror:** Converges light (shaving mirror, satellite dish)
- **Convex mirror:** Diverges light (car side mirror, wider view)

### Refraction:
- Light changes speed when entering different medium → direction changes
- **Snell's Law:** n₁sin i = n₂sin r
- n = c/v (refractive index)

### Lens Formula:
**1/v - 1/u = 1/f**
- Convex lens: f positive, can form real & virtual images
- Concave lens: f negative, always forms virtual image

### Mirror Formula:
**1/v + 1/u = 1/f**

### Magnification:
m = -v/u (mirror) | m = v/u (lens)
m > 0 = erect, m < 0 = inverted`,
    formulas: ['1/v + 1/u = 1/f (mirror)', '1/v - 1/u = 1/f (lens)', 'n₁sin i = n₂sin r', 'm = hᵢ/hₒ = -v/u'],
    examTips: ['Ray diagrams practice karo — at least 5 types', 'Sign convention: distances measured from pole/optical center'],
    commonMistakes: ['Mirror formula mein +, lens mein - between 1/u and 1/v', 'Convex mirror can NEVER form real image — always virtual']
  },
  {
    keywords: ['history', 'indian', 'freedom', 'independence', 'swatantrata', 'gandhi', 'revolution'],
    agent: 'teacher',
    answer: `## 🇮🇳 Indian Freedom Struggle

**Hook:** 200 saal ki gulami ke baad 15 August 1947 ko India azaad hua — lekin yeh raat ek din mein nahi hui!

### Timeline:
- **1857:** First War of Independence (Sepoy Mutiny)
- **1885:** Indian National Congress formed
- **1905:** Partition of Bengal → Swadeshi Movement
- **1919:** Jallianwala Bagh Massacre (April 13)
- **1920:** Non-Cooperation Movement (Gandhi)
- **1930:** Salt March / Dandi March
- **1942:** Quit India Movement ("Do or Die")
- **1947:** Independence (August 15)

### Key Leaders:
| Leader | Contribution |
|--------|-------------|
| Mahatma Gandhi | Non-violence, Satyagraha |
| Bhagat Singh | Revolutionary, sacrificed at 23 |
| Subhash Chandra Bose | "Give me blood, I'll give you freedom" |
| Jawaharlal Nehru | First PM, "Tryst with Destiny" |
| Sardar Patel | Iron Man, united 562 princely states |`,
    formulas: [],
    examTips: ['1857 ke causes — political, social, economic, military — all important', 'Gandhi ke 3 major movements: Non-cooperation, Civil Disobedience, Quit India'],
    commonMistakes: ['1942 Quit India movement ≠ 1857 revolt — don\'t confuse dates', 'Cabinet Mission 1946 was about partition plan, not independence directly']
  },
  {
    keywords: ['english', 'grammar', 'tense', 'verb', 'active passive', 'direct indirect'],
    agent: 'teacher',
    answer: `## 📖 English Grammar — Tenses

**Hook:** English mein "I eat" aur "I ate" mein farak sirf ek letter ka — lekin meaning alag!

### 12 Tenses:
| | Simple | Continuous | Perfect | Perfect Continuous |
|-|--------|-----------|---------|-------------------|
| **Present** | I eat | I am eating | I have eaten | I have been eating |
| **Past** | I ate | I was eating | I had eaten | I had been eating |
| **Future** | I will eat | I will be eating | I will have eaten | I will have been eating |

### Active vs Passive:
- **Active:** Ram eats an apple → Subject does action
- **Passive:** An apple is eaten by Ram → Subject receives action
- Rule: Object + is/am/are/was/were + V3 + by + Subject

### Direct vs Indirect Speech:
- **Direct:** He said, "I am happy"
- **Indirect:** He said that he was happy
- Rule: Present → Past, " " → that, pronouns change`,
    formulas: [],
    examTips: ['Tense identification ke liye helping verb dekho', 'Passive mein V3 (past participle) use hota hai hamesha'],
    commonMistakes: ['Present Perfect ≠ Simple Past — "I have eaten" ≠ "I ate"', 'Reported speech mein tense shift hota hai — present → past']
  },
  {
    keywords: ['ecology', 'environment', 'ecosystem', 'food chain', 'paristhiti'],
    agent: 'teacher',
    answer: `## 🌍 Ecology & Environment

**Hook:** Ek spider web ki tarah — ek thread toote toh poora system affect hota hai!

### Levels:
Organism → Population → Community → Ecosystem → Biome → Biosphere

### Food Chain:
Plants (Producer) → Grasshopper (Primary Consumer) → Frog (Secondary) → Snake (Tertiary) → Eagle (Top)

### Food Web:
Multiple interconnected food chains

### Energy Flow:
- **10% Rule:** Only 10% energy transfers to next level
- Sun → Producers → Primary Consumers → Secondary → Tertiary
- Energy decreases at each trophic level

### Biogeochemical Cycles:
1. **Water Cycle:** Evaporation → Condensation → Precipitation
2. **Carbon Cycle:** Photosynthesis ↔ Respiration
3. **Nitrogen Cycle:** N₂ fixation → Nitrification → Denitrification

### Environmental Issues:
- Ozone depletion (CFCs)
- Global warming (CO₂, CH₄)
- Acid rain (SO₂, NOₓ)`,
    formulas: ['10% energy transfer rule', 'Biomass decreases up trophic levels'],
    examTips: ['Food chain always starts with PRODUCER (plants)', 'Energy pyramid is ALWAYS upright — never inverted'],
    commonMistakes: ['Decomposers are NOT in food chain — they break down dead matter', 'Food web ≠ Food chain — web has multiple chains']
  },
  {
    keywords: ['statistics', 'mean', 'median', 'mode', 'average', 'data'],
    agent: 'teacher',
    answer: `## 📊 Statistics — Data ka Khel!

**Hook:** Exam mein class ka average nikalna — woh statistics hai!

### Measures of Central Tendency:
- **Mean (Average):** Sum of all values / Number of values
- **Median:** Middle value (arrange in order first!)
- **Mode:** Most frequently occurring value

### Formulas:
- **Mean (ungrouped):** x̄ = Σxᵢ / n
- **Mean (grouped):** x̄ = Σfᵢxᵢ / Σfᵢ
- **Median:** (n+1)/2 th term (odd n) | Average of n/2 and (n/2+1)th terms (even n)
- **Mode:** Value with highest frequency

### Important:
- Mean is affected by extreme values (outliers)
- Median is NOT affected by outliers
- Mode can be more than one value

### Range:
Range = Maximum - Minimum`,
    formulas: ['x̄ = Σxᵢ/n', 'x̄ = Σfᵢxᵢ/Σfᵢ', 'Median = (n+1)/2 th value'],
    examTips: ['Pehle data arrange karo ascending order mein (for median)', 'Class mark = (upper + lower)/2 for grouped data'],
    commonMistakes: ['Median ke liye data SORT karna zaroori hai pehle!', 'Mean ≠ Median ≠ Mode generally — they\'re different measures']
  },
  {
    keywords: ['work', 'power', 'energy', 'kaam', 'shakti', 'urja'],
    agent: 'teacher',
    answer: `## ⚡ Work, Energy & Power

**Hook:** Kitna kaam kiya? Kitni energy lagaai? Kitni power hai? — Ye teen alag cheezein hain!

### Work (W):
**W = F × d × cosθ**
- Unit: Joule (J)
- 1 Joule = 1 Newton × 1 meter
- Work = 0 if force ⊥ displacement

### Energy:
- **Kinetic Energy:** KE = ½mv² (moving object)
- **Potential Energy:** PE = mgh (height pe object)
- **Total Energy:** TE = KE + PE (conserved!)

### Power (P):
**P = W/t = F × v**
- Unit: Watt (W)
- 1 Watt = 1 Joule/second
- Commercial unit: kWh (kilowatt-hour)

### Work-Energy Theorem:
Work done = Change in KE
W = ½mv² - ½mu²`,
    formulas: ['W = Fdcosθ', 'KE = ½mv²', 'PE = mgh', 'P = W/t', '1 kWh = 3.6 × 10⁶ J'],
    examTips: ['Force ⊥ displacement = No work done (e.g., carrying load horizontally)', '1 kWh = 1 Unit of electricity — check your electricity bill!'],
    commonMistakes: ['Carrying bag horizontally = NO work against gravity!', 'Power ≠ Energy — Power is rate of energy use']
  },
  {
    keywords: ['acid', 'base', 'salt', 'ph', 'indicator', 'aml', 'kshar'],
    agent: 'teacher',
    answer: `## 🧪 Acids, Bases & Salts

**Hook:** Nimbu khatta hai (acid), sabun phislaata hai (base) — aur namak ek SALT hai!

### Properties:
| | Acid | Base |
|-|------|------|
| Taste | Sour | Bitter |
| Litmus | Blue → Red | Red → Blue |
| pH | < 7 | > 7 |
| Example | HCl, H₂SO₄ | NaOH, Ca(OH)₂ |

### pH Scale:
0 ← Strong Acid ... 7 (Neutral) ... Strong Base → 14
- Stomach acid: pH 1-2
- Blood: pH 7.35-7.45
- Milk of Magnesia: pH 10

### Neutralization:
**Acid + Base → Salt + Water**
HCl + NaOH → NaCl + H₂O

### Important Salts:
- NaCl (Common salt) — from HCl + NaOH
- CaCO₃ (Limestone) — from Ca(OH)₂ + CO₂
- CuSO₄ (Blue vitriol) — from CuO + H₂SO₄`,
    formulas: ['pH = -log[H⁺]', 'pOH = -log[OH⁻]', 'pH + pOH = 14'],
    examTips: ['pH = 7 neutral, <7 acid, >7 base — yaad rakhho', 'Strong acid + strong base = neutral salt (pH = 7)'],
    commonMistakes: ['pH 0 is STRONGEST acid, pH 14 is STRONGEST base', 'Not all acids are dangerous — citric acid (lemon) is safe!']
  },
  {
    keywords: ['sound', 'wave', 'frequency', 'doppler', 'dhvani', 'tarang'],
    agent: 'teacher',
    answer: `## 🔊 Sound Waves

**Hook:** Thunder ke baad lightning pehle dikhti hai, sound baad mein aata hai — kyunki light sound se fast hai!

### Key Properties:
- **Speed in air:** 343 m/s (at 20°C)
- **Frequency:** Number of vibrations per second (Hz)
- **Wavelength:** λ = v/f
- **Time Period:** T = 1/f

### Characteristics:
- **Pitch:** High frequency = high pitch (whistle), Low frequency = low pitch (drum)
- **Loudness:** Higher amplitude = louder sound
- **Quality/Timbre:** Why same note sounds different on different instruments

### Doppler Effect:
Source moving towards you → Higher frequency (pitch ↑)
Source moving away → Lower frequency (pitch ↓)

### Echo:
Sound reflects back after 0.1 seconds
Minimum distance for echo = 343 × 0.1/2 = 17.15 m`,
    formulas: ['v = fλ', 'T = 1/f', 'Echo distance = vt/2', 'Doppler: f\' = f(v±vₒ)/(v∓vₛ)'],
    examTips: ['Sound needs MEDIUM — it CANNOT travel in vacuum!', 'Human hearing range: 20Hz - 20,000Hz'],
    commonMistakes: ['Sound can\'t travel in vacuum — light can!', 'Speed of sound increases with temperature']
  },
  {
    keywords: ['coordinate', 'geometry', 'distance', 'section formula', 'midpoint', 'nishchay'],
    agent: 'teacher',
    answer: `## 📐 Coordinate Geometry

**Hook:** Google Maps pe location lat/long se pata chalta hai — Coordinate geometry bhi aise hi kaam karta hai!

### Distance Formula:
**d = √((x₂-x₁)² + (y₂-y₁)²)**

### Section Formula (Internal):
Point dividing in ratio m:n:
**(mx₂+nx₁)/(m+n), (my₂+ny₁)/(m+n)**

### Midpoint:
**M = ((x₁+x₂)/2, (y₁+y₂)/2)**

### Area of Triangle:
**A = ½|x₁(y₂-y₃) + x₂(y₃-y₁) + x₃(y₁-y₂)|**

### Centroid:
**G = ((x₁+x₂+x₃)/3, (y₁+y₂+y₃)/3)**

### Slope of Line:
**m = (y₂-y₁)/(x₂-x₁)**`,
    formulas: ['d = √((x₂-x₁)²+(y₂-y₁)²)', 'Section: (mx₂+nx₁)/(m+n)', 'Mid: ((x₁+x₂)/2, (y₁+y₂)/2)', 'Area = ½|x₁(y₂-y₃)+x₂(y₃-y₁)+x₃(y₁-y₂)|'],
    examTips: ['Area of triangle = 0 means points are COLLINEAR', 'Distance formula se types of triangle check kar sakte ho'],
    commonMistakes: ['Section formula mein ratio ka order important hai (m:n ≠ n:m)', 'Slope undefined jab x₂=x₁ (vertical line)']
  },
  {
    keywords: ['reproduction', 'prajanan', 'sexual', 'asexual', 'reproductive'],
    agent: 'teacher',
    answer: `## 🧬 Reproduction

**Hook:** Ek plant se doosra plant kaise banta hai? Reproduction — life continue rakhne ka tarika!

### Types:
| | Asexual | Sexual |
|-|---------|--------|
| Parents | One | Two (male + female) |
| Offspring | Identical (clone) | Different (variation) |
| Speed | Fast | Slow |
| Example | Budding, Binary fission | Human, flowering plants |

### Asexual Methods:
1. **Binary Fission:** Bacteria (splits in two)
2. **Budding:** Hydra, Yeast
3. **Fragmentation:** Planaria, Spirogyra
4. **Spore Formation:** Rhizopus (bread mold)
5. **Vegetative Propagation:** Potato, Onion (eyes/buds)

### Human Reproductive System:
- **Male:** Testes (sperm) → Vas deferens → Urethra
- **Female:** Ovary (egg) → Fallopian tube → Uterus
- **Fertilization:** Sperm + Egg = Zygote (in fallopian tube)
- **Implantation:** Uterus wall
- **Gestation:** 9 months (280 days)

### Flower Parts:
- Stamen (male) = Anther + Filament
- Pistil (female) = Stigma + Style + Ovary`,
    formulas: [],
    examTips: ['Asexual = fast but no variation | Sexual = slow but variation for survival', 'Flower diagram with labels — always asked!'],
    commonMistakes: ['Binary fission ≠ Budding — fission splits, budding grows out', 'Fertilization happens in FALLOPIAN TUBE, not uterus']
  },
  {
    keywords: ['force', 'bal', 'pressure', 'pressure area', 'friction', 'mahrasan'],
    agent: 'teacher',
    answer: `## 💪 Force & Pressure

**Hook:** Why does a sharp knife cut better than blunt? Pressure! Same force, less area = more pressure!

### Force:
- Push or Pull
- Unit: Newton (N)
- SI unit of force = kg⋅m/s²

### Types of Forces:
- **Contact:** Friction, Normal, Tension, Spring
- **Non-contact:** Gravity, Magnetic, Electrostatic

### Pressure:
**P = F/A** (Force per unit area)
- Unit: Pascal (Pa) = N/m²
- More area = Less pressure (elephant feet vs high heels!)
- Less area = More pressure (sharp knife vs blunt knife!)

### Atmospheric Pressure:
- Air column above us exerts pressure
- 1 atm = 101325 Pa = 760 mm Hg
- Applications: Straw, suction cup, syringe

### Friction:
- Opposes relative motion
- Static friction > Sliding friction > Rolling friction
- Necessary for walking, braking
- Reduced by: lubricants, polished surfaces, ball bearings`,
    formulas: ['P = F/A', '1 atm = 101325 Pa', 'F_friction = μN'],
    examTips: ['Pressure inversely proportional to area — more area, less pressure', 'Friction is NECESSARY — without it we can\'t walk!'],
    commonMistakes: ['Friction is NOT always bad — walking needs friction!', 'Pressure and force are DIFFERENT — same force, different area = different pressure']
  },
  {
    keywords: ['coding', 'programming', 'python', 'javascript', 'code', 'html', 'css'],
    agent: 'teacher',
    answer: `## 💻 Programming Basics

**Hook:** Agar tum recipe follow karke khana bana sakte ho, toh code bhi likh sakte ho — programming is just a recipe for computers!

### What is Programming?
Set of instructions jo computer step-by-step follow karta hai.

### Key Concepts:
1. **Variables:** Box mein data store karo (x = 5)
2. **Data Types:** Numbers, Text (String), Boolean (True/False)
3. **Conditions:** IF something → do this, ELSE → do that
4. **Loops:** REPEAT something multiple times (for, while)
5. **Functions:** Reusable code blocks

### Python Example:
\`\`\`python
# Simple program
name = "Nikhil"
age = 18
if age >= 18:
    print(name + " can vote!")
else:
    print(name + " cannot vote yet")
\`\`\`

### HTML/CSS/JS (Web):
- **HTML:** Structure (skeleton)
- **CSS:** Style (clothing)
- **JavaScript:** Behavior (brain)`,
    formulas: [],
    examTips: ['Computer Science mein pseudocode likhna aana chahiye', 'Logic building > Syntax memorization'],
    commonMistakes: ['= means ASSIGN, == means COMPARE', 'Indexing 0 se start hoti hai programming mein (not 1!)']
  },
  {
    keywords: ['constitution', 'samvidhan', 'rights', 'fundamental', 'duties', 'democracy'],
    agent: 'teacher',
    answer: `## ⚖️ Indian Constitution

**Hook:** India ka rulebook — Constitution — world ka LARGEST written constitution hai!

### Key Facts:
- **Adopted:** November 26, 1949
- **Enforced:** January 26, 1950 (Republic Day!)
- **Dr. B.R. Ambedkar:** Chairman, Drafting Committee ("Father of Indian Constitution")
- **Original copies:** Calligraphed, not printed
- **Languages:** Hindi + English

### Fundamental Rights (Part III):
1. Right to Equality (Art. 14-18)
2. Right to Freedom (Art. 19-22)
3. Right against Exploitation (Art. 23-24)
4. Right to Freedom of Religion (Art. 25-28)
5. Cultural & Educational Rights (Art. 29-30)
6. Right to Constitutional Remedies (Art. 32) — "Heart and Soul" (Dr. Ambedkar)

### Fundamental Duties (Part IV-A):
- Added by 42nd Amendment (1976)
- 11 duties total
- Not enforceable by law

### Preamble Keywords:
Sovereign, Socialist, Secular, Democratic, Republic, Justice, Liberty, Equality, Fraternity`,
    formulas: [],
    examTips: ['6 Fundamental Rights yaad karo — number + name', 'Right to Constitutional Remedies = "Heart and Soul" (always asked!)'],
    commonMistakes: ['Right to Property is NOT a Fundamental Right anymore (44th Amendment, 1978)', 'Duties are NOT legally enforceable — Rights ARE']
  },
];

// ============================================================
// SMART RESPONSE ENGINE — Composes dynamic responses
// Even without API, generates contextual answers
// ============================================================

function findLocalKnowledge(query: string): KnowledgeEntry | null {
  const lower = query.toLowerCase();
  let bestMatch: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length; // Longer keyword matches = better
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

function composeDynamicResponse(query: string, agent: AgentType): string {
  const topic = query.length > 60 ? query.slice(0, 60) + '...' : query;
  
  // Smart template engine — creates structured responses dynamically
  switch (agent) {
    case 'teacher':
      return `## 📚 ${topic}

### Quick Summary:
Yeh ek important topic hai jo exams mein frequently aata hai. Chalo samajhte hain!

### Key Points:
- Is concept ki foundation clear honi chahiye
- NCERT textbook mein is chapter ko dhyan se padho
- Diagram ke saath samjhna zyada effective hota hai

### 💡 Study Tip:
1. Pehle NCERT ka theory padho
2. Phir examples solve karo
3. Previous year questions zaroor dekho
4. Short notes banao revision ke liye

### 🎯 Exam Strategy:
- Is topic se 2-5 marks ke questions aate hain
- Diagram + explanation = full marks
- Definition + formula + example = complete answer

> 🔌 **Pro Tip:** OpenAI API key add karo settings mein — phir detailed AI explanation milega with examples, formulas, aur exam-specific tips!`;

    case 'notes':
      return `## 📝 Notes: ${topic}

### Overview
${topic} ek important concept hai jo exam perspective se bahut relevant hai.

### Key Concepts
- **Definition**: Is concept ki formal definition NCERT se refer karo
- **Important Points**: 
  - Point 1: Foundation concept
  - Point 2: Application areas
  - Point 3: Common exam questions
- **Formulas**: Related formulas yahan list karo

### ⚠️ Common Mistakes
1. Students often confuse related terms
2. Units ki jagah galat units likhna
3. Sign convention errors

### 📝 Remember Box
- Core concept yaad rakhho
- Formula + unit sath mein likho
- Example har point ke sath do

### Practice Questions
1. [2-mark] Define the concept with example
2. [5-mark] Explain with diagram

> 🔌 API key enable karo for AI-generated detailed notes!`;

    case 'quiz':
      return `## 🎯 Quiz: ${topic}

### Format: 5 MCQs (Easy → Hard)

**Q1.** Basic definition question (Easy)
A) Option A  B) Option B  C) Option C  D) Option D
→ Hint: NCERT Chapter 1 se aata hai

**Q2.** Conceptual understanding (Easy)
A) Option A  B) Option B  C) Option C  D) Option D
→ Hint: Diagram se related hai

**Q3.** Application-based (Medium)
A) Option A  B) Option B  C) Option C  D) Option D
→ Hint: Formula use karo

**Q4.** Numerical/Trick (Medium)
→ Calculation required

**Q5.** Previous year pattern (Hard)
→ Multi-concept question

### 📊 Time: 10 minutes | Marks: 5

> 🔌 API key enable karo for 10-question exam-style quizzes with detailed explanations!`;

    case 'revision':
      return `## ⚡ Quick Revision: ${topic}

### In 30 Seconds:
- ⭐ Core concept 1 line mein
- ⭐ Key formula yaad karo
- ⭐ Most common exam question type

### Mnemonic:
[Topic ke liye mnemonic create karo — Hinglish mein easy hota hai]

### Must Remember:
| # | Point | Key |
|---|-------|-----|
| 1 | Core concept | Definition |
| 2 | Main formula | Units |
| 3 | Common mistake | Avoid this |

### Before Exam:
- [ ] NCERT examples done?
- [ ] Previous year questions solved?
- [ ] Diagram practiced?
- [ ] Formula sheet ready?

> 🔌 API key enable karo for smart revision sheets with mnemonics!`;

    case 'doubt':
      return `## ❓ Doubt: ${topic}

### Quick Answer:
Yeh doubt clear karne ke liye basic concept samajhna zaroori hai.

### Explanation:
1. **Basic concept**: Pehle foundation clear karo
2. **Why it works**: Reason samjho
3. **Example**: Real-life se connect karo

### Related Concepts:
- Isse connected topics bhi padho
- Previous year mein kaise pucha gaya hai

### What to Study Next:
- NCERT ka related chapter
- Practice similar problems
- Watch concept video for visual understanding

> 🔌 API key enable karo for instant detailed doubt resolution!`;

    case 'assignment':
      return `## ✍️ Assignment Help: ${topic}

### Understanding the Question:
Break down karo — exactly kya puch raha hai?

### Step-by-Step Approach:
1. **Read** question 2 baar dhyan se
2. **Identify** keywords — main kya chahiye?
3. **Plan** structure — intro, body, conclusion
4. **Draft** answer — keywords include karo
5. **Review** — word limit, format check

### Key Points to Include:
- [ ] Definition of main concept
- [ ] Formula (if applicable)
- [ ] Example/diagram
- [ ] Conclusion/summary
- [ ] References (if needed)

### Time Management:
- Planning: 10% time
- Writing: 70% time
- Review: 20% time

> 🔌 API key enable karo for detailed step-by-step assignment guidance!`;

    case 'productivity':
      return `## 📅 Study Plan: ${topic}

### Daily Schedule Template:
| Time | Activity | Duration |
|------|----------|----------|
| 6-8 AM | 🌅 New concepts | 2hr |
| 10-12 PM | ☀️ Practice/MCQs | 2hr |
| 3-5 PM | 🌤️ Medium topics | 2hr |
| 7-8 PM | 🌙 Light revision | 1hr |

### Pomodoro Technique:
- 25 min FOCUS → 5 min break
- 4 sessions → 15 min break
- Total: 2 hours of deep study

### Priority Matrix:
| Must Do 🔴 | Should Do 🟡 | Could Do 🟢 |
|------------|--------------|-------------|
| Core concepts | Important formulas | Extra practice |
| NCERT examples | Previous year Qs | Reference books |

### Weekly Review:
- Sunday: Full revision day
- Take mock tests
- Analyze weak areas

> 🔌 API key enable karo for personalized AI study plans!`;

    default:
      return `## 🤖 ${topic}

Main is topic pe kaam kar raha hoon. Kuch specific puchna hai toh type karo!

### Suggestions:
- "Explain [topic] like a teacher"
- "Create notes on [topic]"
- "Give me a quiz on [topic]"
- "Quick revision for [topic]"

> 🔌 API key enable karo for powerful AI responses!`;
  }
}

// ============================================================
// AGENT PROMPTS — For API-powered responses
// ============================================================

const AGENT_PROMPTS: Record<AgentType, string> = {
  teacher: `You are NikNote AI Teacher — India's most loved learning platform built for CBSE/ICSE/JEE/NEET students.

CRITICAL RULES:
1. Start with a relatable HINGLISH hook (1-2 lines connecting topic to daily life)
2. Then give a 1-line SIMPLE SUMMARY anyone can understand
3. Then explain in 3 LEVELS:
   🟢 BEGINNER: Simple words, real-life Indian examples (cricket, chai, traffic, school). Use analogies.
   🟡 INTERMEDIATE: Technical terms, Hindi+English mix, formulas with meaning explained
   🔴 EXAM-FOCUSED: Exact exam pattern answers (2-mark, 3-mark, 5-mark format), NCERT language, numerical examples with FULL solutions
4. ALWAYS include:
   - 📐 Formulas section (if applicable)
   - 💡 3+ Exam Tips from previous year patterns
   - ⚠️ Common Mistakes students make (at least 2)
   - 🎯 One practice question with solution
5. Use HINGLISH naturally (Hindi+English mix like Indian students speak)
6. Be warm, encouraging, like a favorite teacher
7. Use Markdown formatting: ## headings, **bold** keywords, bullet points, tables
8. Keep under 800 words but EVERY word must be valuable`,

  notes: `You are NikNote Notes Agent — creating EXAM-READY notes that students can revise in 10 minutes.

STRUCTURE (FOLLOW EXACTLY):
## 📚 [Topic Name] — Complete Notes

### 🎯 Quick Summary (2-3 lines max)

### 📖 Key Concepts
- Each concept as a bullet with **bold** keyword
- Include simple definition first, then technical
- Use → arrows to show cause-effect

### 📐 Important Formulas
- Each formula on new line with \`code\` formatting
- Explain what each variable means
- Give a quick example calculation

### 📊 Comparison Table (if applicable)
| Feature | X | Y |
Create comparison tables for related concepts

### ⚠️ Common Mistakes
- List 3+ mistakes with ✅ correct vs ❌ wrong format

### 💡 Exam Tips
- Previous year question patterns
- Marks distribution tips

### 🎯 Practice Questions (3 questions: Easy/Medium/Hard)

Use HINGLISH. Make it SCANNABLE — headers, bullets, tables, bold keywords.`,

  research: `You are NikNote Research Agent — finding ACCURATE, VERIFIED information for Indian students.

RULES:
- Provide factually correct, well-researched information
- Cite NCERT, standard textbooks, or reliable sources
- Cross-verify important claims
- Present multiple perspectives when topic is debated
- Flag any controversial or disputed information clearly
- Include historical context if relevant
- Compare with similar concepts/phenomena
- Keep exam-relevant — don't go too deep into research paper territory
- Use HINGLISH for explanations`,

  diagram: `You are NikNote Diagram Agent — creating visual learning aids for Indian students.

RULES:
1. Suggest what diagrams would help understanding
2. Describe diagrams in DETAIL so they can be drawn:
   - What to draw (shapes, lines, arrows)
   - What to label
   - Colors/shading suggestions
3. Include Mermaid.js syntax for flowcharts (use \`\`\`mermaid blocks)
4. For biology/chemistry: Describe labeled diagram step-by-step
5. For physics/math: Describe graph/figure with coordinates
6. Always explain WHY the diagram helps memory
7. Mark exam-relevant parts with ⭐
8. Keep it PRACTICAL — student should be able to draw in exam`,

  revision: `You are NikNote Revision Agent — creating ULTRA-CONCISE revision for last-minute prep.

FORMAT (STRICT):
## ⚡ [Topic] — 5-Min Revision

### 🎯 30-Second Summary (3 bullet points max)

### 🔑 Key Points Only
- Only what's IMPORTANT for exams
- No explanations — just facts and formulas
- Bold the keywords that examiners look for

### 🧠 Memory Tricks / Mnemonics
- Create 1-2 mnemonics for hard-to-remember facts
- Use funny/relatable Hindi mnemonics

### 📐 Formulas Cheat Sheet
- All formulas in compact format
- Variable meanings in brackets

### ✅ Do vs ❌ Don't
| ✅ Correct | ❌ Common Mistake |

### 🎯 Exam Hack
One killer tip that saves marks

ONE PAGE MAX. Every word must earn its place.`,

  quiz: `You are NikNote Quiz Agent — creating EXAM-STYLE tests for Indian students.

FORMAT (FOLLOW EXACTLY):
## 🎯 [Topic] — Practice Quiz

### Easy (2 marks each)
Q1. [Question]
A) [option] B) [option] C) [option] D) [option]
✅ Answer: [letter] — [1-line explanation]

### Medium (3 marks each)
[Same format, harder questions, assertion-reason type]

### Hard (5 marks each)
[Same format, numerical/trick questions]

### 🎯 Answers & Explanations
For EACH question:
- Why correct answer is correct (2 lines)
- Why other options are wrong (1 line each)
- Exam tip related to this concept

RULES:
- 3 Easy + 4 Medium + 3 Hard questions
- Include assertion-reason type (common in JEE/NEET)
- Include at least 1 numerical
- Include 1 "trick" question (tests deep understanding)
- Mark difficulty with emoji: 🟢🟡🔴
- Always explain ALL options, not just correct one`,

  assignment: `You are NikNote Assignment Agent — GUIDING students to complete assignments themselves.

RULES:
- NEVER write the full answer — guide the student
- Give step-by-step APPROACH (what to do first, second, etc.)
- Provide a STRUCTURE/TEMPLATE they can fill
- List KEY POINTS they must include
- Give SELF-CHECK questions ("Did you include X?")
- Suggest references (NCERT chapter, page numbers)
- If stuck, give hints not answers
- Be encouraging: "You've got this! Start with..."

FORMAT:
1. 📋 What's Being Asked (break down the question)
2. 🗺️ Step-by-Step Approach
3. 📝 Structure Template
4. ✅ Key Points Checklist
5. 🔍 Self-Check Questions`,

  doubt: `You are NikNote Doubt Solver — answering questions INSTANTLY with patience.

RULES:
1. ANSWER FIRST (direct answer in 1-2 lines)
2. Then EXPLAIN WHY (step-by-step reasoning)
3. Use ANALOGIES (relate to daily life)
4. If doubt is unclear, ask 1 clarifying question
5. Reference related concepts they should know
6. Suggest what to study NEXT
7. If unsure, honestly say "verify from NCERT chapter X"
8. NEVER make the student feel dumb — "Great question!"
9. Use HINGLISH for natural feel

FORMAT:
**Answer:** [Direct answer]
**Why?** [Explanation]
**Example:** [Real-life analogy]
**Related:** [What else to study]`,

  productivity: `You are NikNote Study Plan Agent — creating REALISTIC study schedules.

RULES:
- Create practical schedules (not 16-hour study days!)
- Include Pomodoro technique (25 min study + 5 min break)
- Add proper breaks, exercise, sleep
- Prioritize: Weak topics first, strong topics for revision
- Include DAILY, WEEKLY, and MONTHLY plans
- Add revision slots (spaced repetition)
- Keep FLEXIBLE — life happens
- Consider Indian exam timelines

FORMAT:
## 📅 Study Plan: [Exam/Goal]

### 🎯 Daily Schedule (Realistic)
| Time | Activity | Duration |

### 📊 Weekly Goals
- Week 1: [topics]
- Week 2: [topics]

### 🔥 Priority Matrix
- HIGH priority: [weak topics]
- MEDIUM: [moderate topics]  
- LOW: [strong topics, just revision]

### 💡 Pro Tips for Focus`,

  handwriting: `You are NikNote Handwriting Agent — analyzing and improving handwriting.

RULES:
- Analyze: slant, pressure, spacing, size, baseline, connectivity
- Give specific improvement exercises
- Suggest which HandwritingDNA preset matches
- Be constructive and encouraging
- Provide 5-minute daily practice routine`,

  document: `You are NikNote Document Agent — extracting knowledge from uploaded documents.

RULES:
- Read and understand the full document
- Extract KEY information: definitions, formulas, dates, names
- Generate structured notes from content
- Identify exam-relevant sections
- Create flashcards from key facts
- Suggest related study topics
- Flag any confusing/ambiguous parts`,
};

// ============================================================
// AI BRAIN — local knowledge, authenticated AI function, offline fallback.
// ============================================================

async function callAIBrain(
  messages: AgentMessage[],
  agentType: AgentType,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const systemPrompt = AGENT_PROMPTS[agentType];

  // 1. Check local knowledge base first (INSTANT)
  const localMatch = findLocalKnowledge(lastMessage);
  if (localMatch) {
    await new Promise(r => setTimeout(r, 200));
    let response = localMatch.answer;
    
    if (localMatch.formulas && localMatch.formulas.length > 0 && agentType !== 'diagram') {
      response += `\n\n### 📐 All Related Formulas:\n`;
      localMatch.formulas.forEach(f => { response += `- \`${f}\`\n`; });
    }
    if (localMatch.examTips && localMatch.examTips.length > 0) {
      response += `\n\n### 💡 Exam Tips:\n`;
      localMatch.examTips.forEach(t => { response += `- ${t}\n`; });
    }
    if (localMatch.commonMistakes && localMatch.commonMistakes.length > 0) {
      response += `\n\n### ⚠️ Common Mistakes:\n`;
      localMatch.commonMistakes.forEach(m => { response += `- ${m}\n`; });
    }
    return response;
  }

  // AI requests go through the authenticated server function; no provider keys in the browser.
  const formattedMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  try {
    const { data, error } = await supabase.functions.invoke('openai-brain', {
      body: {
        messages: formattedMessages,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
      },
    });
    if (error) throw error;
    const content = data?.content || data?.text || (typeof data === 'string' ? data : JSON.stringify(data));
    if (content && content.length > 50 && !content.includes('error')) return enhanceResponse(content, agentType);
  } catch (err) {
    console.warn(`Supabase AI error (will use local):`, err);
  }

  // 6. Dynamic response engine (always works, offline)
  return composeDynamicResponse(lastMessage, agentType);
}

// ============================================================
// RESPONSE ENHANCER — Makes any AI output better
// ============================================================

function enhanceResponse(text: string, agentType: AgentType): string {
  let enhanced = text;

  // If response is too short, it's probably low quality
  if (enhanced.length < 100) return enhanced;

  // Add exam tips if missing and agent is teacher/notes/revision
  if (['teacher', 'notes', 'revision'].includes(agentType)) {
    if (!enhanced.includes('Exam Tip') && !enhanced.includes('💡') && !enhanced.includes('exam tip')) {
      enhanced += '\n\n---\n💡 **NikNote Tip:** Yeh topic CBSE/ICSE exams mein frequently aata hai — NCERT textbook ka example zaroor padho!';
    }
  }

  // Add "Next Step" suggestion if missing
  if (!enhanced.includes('Next') && !enhanced.includes('Aage kya') && agentType === 'teacher') {
    enhanced += '\n\n🔄 **Aage kya padhein?** Related topic pe click karo ya apna next question poocho!';
  }

  return enhanced;
}

// ============================================================
// AGENT ORCHESTRATOR — Main coordinator
// ============================================================

export class AgentOrchestrator {
  private conversationHistory: AgentMessage[] = [];

  async chat(
    userMessage: string,
    preferredAgent?: AgentType,
    onChunk?: (chunk: string) => void
  ): Promise<AgentResponse> {
    this.conversationHistory.push({ role: 'user', content: userMessage });
    const agent = preferredAgent || this.detectAgent(userMessage);
    const response = await callAIBrain(this.conversationHistory, agent, onChunk);
    this.conversationHistory.push({ role: 'assistant', content: response, agent });

    return {
      content: response,
      agent,
      suggestions: this.generateSuggestions(userMessage, agent),
      actions: this.generateActions(userMessage, agent),
    };
  }

  private detectAgent(message: string): AgentType {
    const lower = message.toLowerCase();
    if (/samjhao|explain karo|batao|kya hota hai|kaise kaam/.test(lower)) return 'teacher';
    if (/notes banao|notes chahiye|summary banao/.test(lower)) return 'notes';
    if (/doubt hai|confused|samajh nahi aaya/.test(lower)) return 'doubt';
    if (/quiz|test|mcq|question paper|practice/.test(lower)) return 'quiz';
    if (/revision|revise|cheat sheet|last minute|yaad/.test(lower)) return 'revision';
    if (/assignment|homework|project|submit/.test(lower)) return 'assignment';
    if (/diagram|flowchart|chart|visual|drawing/.test(lower)) return 'diagram';
    if (/plan|schedule|timetable|routine|strategy/.test(lower)) return 'productivity';
    if (/research|find|search|source|reference/.test(lower)) return 'research';
    if (/pdf|document|upload|file|paper/.test(lower)) return 'document';
    if (/handwriting|likhavat|likhna/.test(lower)) return 'handwriting';
    if (/quiz|test|mcq|exam/.test(lower)) return 'quiz';
    if (/notes|summary|points|important/.test(lower)) return 'notes';
    if (/revision|revise|quick|last.?minute/.test(lower)) return 'revision';
    if (/doubt|confused|explain|why|kya|kaise|kyu/.test(lower)) return 'doubt';
    return 'teacher';
  }

  private generateSuggestions(query: string, currentAgent: AgentType): string[] {
    const short = query.length > 40 ? query.slice(0, 40) + '...' : query;
    const suggestions: string[] = [];
    if (currentAgent !== 'notes') suggestions.push(`📝 Notes banao "${short}" ke`);
    if (currentAgent !== 'quiz') suggestions.push(`🎯 Quiz solve karo "${short}" pe`);
    suggestions.push(`🧠 Mind Map banao "${short}" ka`);
    if (currentAgent !== 'revision') suggestions.push(`📖 Quick Revision "${short}" ka`);
    suggestions.push(`🃏 Flashcards banao revision ke liye`);
    if (currentAgent !== 'diagram') suggestions.push(`📊 Diagrams add karo`);
    return suggestions.slice(0, 5);
  }

  private generateActions(query: string, currentAgent: AgentType): AgentAction[] {
    const actions: AgentAction[] = [];
    if (currentAgent !== 'notes') actions.push({ type: 'create_notes', label: 'Generate Notes', icon: '📝' });
    actions.push({ type: 'create_flashcards', label: 'Flashcards', icon: '🃏' });
    actions.push({ type: 'create_quiz', label: 'Start Quiz', icon: '🎯' });
    actions.push({ type: 'create_mindmap', label: 'Mind Map', icon: '🧱' });
    if (currentAgent !== 'revision') actions.push({ type: 'create_revision', label: 'Quick Revision', icon: '📖' });
    actions.push({ type: 'add_diagram', label: 'Diagrams', icon: '📊' });
    return actions;
  }

  async generateNotes(topic: string) {
    const [explanation, notes, revision] = await Promise.all([
      this.chat(`Explain "${topic}"`, 'teacher'),
      this.chat(`Create notes on "${topic}"`, 'notes'),
      this.chat(`Revision sheet for "${topic}"`, 'revision'),
    ]);
    return { explanation: explanation.content, notes: notes.content, revision: revision.content };
  }

  clearHistory() { this.conversationHistory = []; }
  getHistory(): AgentMessage[] { return this.conversationHistory; }
}

export const aiOrchestrator = new AgentOrchestrator();
