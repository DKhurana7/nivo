# Nivo Outbound Voice Telephony — Regulatory & Provider Research

**Researched:** 2026-09-23. All URLs below were accessed on 2026-09-23 unless otherwise noted.
**Scope:** outbound AI voice agent calling Indian building-material vendors, on self-hosted LiveKit v1.13.7 + LiveKit SIP + Agents Python SDK v1.6.5.

Confidence labels used throughout:
- **[VERIFIED]** — primary source (TRAI gazette notification, DoT/PIB release, provider's own docs/pricing page), URL cited.
- **[UNCERTAIN]** — secondary source, or my inference from primary text. Flagged as such.
- **[UNKNOWN]** — I could not find a real source. Not guessed.

---

## 0. Bottom line

**Is it feasible?** Technically yes. Legally, it is feasible *only* on a narrow, compliant path, and that path costs you time and paperwork before the first call. It is **not** a "sign up with a card and start dialling" feature.

**Three hard gates, in order of severity:**

1. **You must be an Indian registered entity with GST to make domestic India-origin calls at all.** Plivo's own docs state plainly: *"Only businesses registered in India can"* rent Indian numbers and make domestic calls; foreign businesses must route internationally ([Plivo India calling docs](https://www.plivo.com/docs/voice/concepts/india-calling)). Twilio cannot help here at all — Twilio's India voice guidelines state *"Outbound calls to India can only be made from international (non-Indian) numbers"* ([Twilio India Voice Guidelines](https://www.twilio.com/en-us/guidelines/in/voice)). **[VERIFIED]**

2. **As of 18 September 2026, your AI agent's calls are legally "A2P calls" and must be pre-declared to the originating carrier before you dial.** TRAI's Third Amendment to TCCCPR 2018 defines an A2P call as one *"initiated by an application, software system, or automated platform without direct human dialling ... including using autodialling, robo-calls and/or pre-recorded/artificial voice technologies"*, and substitutes a new Regulation 4: *"Every Sender shall declare to the Originating Access Provider (OAP), in advance, about the use of Application-to-Person (A2P) calls, along with the details such as Calling Line Identification (CLI) ranges to be used ... Provided that any such call made by a Sender without prior declaration to the OAP, shall be treated as Unsolicited commercial communication, and the OAP shall take action against such Sender as per the provisions of these regulations."* ([TRAI Regulation 05 of 2026, 18 Sep 2026, PDF](https://trai.gov.in/sites/default/files/2026-09/Regulation_18092026.pdf)) **[VERIFIED]**

3. **"Asking a supplier for a rate" most likely IS a commercial communication under TCCCPR, and unregistered commercial communication is automatically UCC.** The 2018 principal regulation defines Commercial Communication as *"any voice call or message using telecommunication services, where the primary purpose is to inform about or advertise or **solicit business for** ... (B) **a supplier or prospective supplier of offered goods or services**"* ([TCCCPR 2018, p.2](https://trai.gov.in/sites/default/files/2025-01/RegulationUcc19072018.pdf)). The 2025 Second Amendment adds: *"any commercial communication made by a Sender which is not registered with any Access Provider for the purpose of sending commercial communication shall be treated as an Unsolicited Commercial Communication"* ([TRAI Regulation 1 of 2025, 12 Feb 2025, PDF](https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf)). **[VERIFIED]** — the *application* of clause (B) to a buyer-side procurement call is my reading, see §1.3. **[UNCERTAIN]**

**Recommended path:** Incorporate/verify an Indian entity with GST → **Plivo India** SIP trunk (INR billing, in-country media, published price, official LiveKit quickstart, no minimum) → register as a Sender with the Originating Access Provider on DLT → pre-declare A2P use and CLI ranges → scrub against NCPR/DND → disclose the AI at call open → dial only 09:00–21:00 IST.

**Fallback:** Exotel vSIP (licensed UL-VNO, LiveKit-aware, heavier onboarding, prices not published).

**Biggest risk:** Not a fine — it is **summary disconnection**. TRAI's own explanatory memo records that in April 2026, *"out of the total 20,591 disconnections, 15,736 SIP/PRI connections (used for A2P calls) were disconnected, accounting for approximately 75% of the total disconnections"* ([Regulation 05 of 2026, explanatory memo](https://trai.gov.in/sites/default/files/2026-09/Regulation_18092026.pdf)). Carriers are killing SIP trunks used for A2P at scale, right now. A handful of vendor complaints can take your trunk offline with no notice, and the regulations give the Access Provider a 24-hour cross-operator blacklist propagation duty. Nivo's core product does not depend on telephony; do not let a rate-collection convenience feature put a blacklist flag on the company's GST/PAN.

**Honest assessment:** if Nivo's pilot is "tens of calls/month", the compliance overhead (entity + GST + KYC + DLT sender registration + A2P pre-declaration + DND scrubbing + a legal review) is disproportionate to the value. §5.4 proposes lower-risk alternatives that I would pick first at pilot scale.

---

## 1. Indian regulatory reality

### 1.1 The governing instruments

| Instrument | Date | Status | Source |
|---|---|---|---|
| Telecom Commercial Communications Customer Preference Regulations, 2018 (6 of 2018) | 19 Jul 2018 | In force, as amended | [PDF](https://trai.gov.in/sites/default/files/2025-01/RegulationUcc19072018.pdf) |
| First Amendment | 21 Dec 2018 | In force | referenced in [TRAI consultation notice](https://www.trai.gov.in/consultation-draft-telecom-commercial-communications-customer-preference-third-amendment) |
| **Second Amendment (1 of 2025)** | 12 Feb 2025 | In force | [PDF](https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf) |
| **Third Amendment (05 of 2026)** | 18 Sep 2026 | **Phasing in now** | [PDF](https://trai.gov.in/sites/default/files/2026-09/Regulation_18092026.pdf) |
| Telecommunications Act, 2023 (44 of 2023) | 2023 | Partially notified | [India Code PDF](https://www.indiacode.nic.in/bitstream/123456789/20101/1/A2023-44.pdf) |
| DoT 1600 numbering series allotment | 2024 | In force | [PIB release PRID 2022249](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2022249&reg=48&lang=2) — *note: PIB returned HTTP 403 to my fetch; cited from search result metadata* **[UNCERTAIN]** |

**Commencement of the Third Amendment [VERIFIED]** — from the notification text: it comes into force 30 days after Gazette publication, *"except (a) regulation 4, regulation 6, regulation 8(a) and regulation 18, which shall come into force after sixty days; and (b) the amendments listed in Annexure, which shall come into force after ninety days."* Regulation 4 is the A2P pre-declaration duty and regulation 18 is the A2P termination charge — so **the A2P pre-declaration obligation bites approximately mid-November 2026**, i.e. before any realistic Nivo launch. Do not build to the pre-September rules.

### 1.2 What the A2P rules require of Nivo — the single most important section

**[VERIFIED]** Verbatim from Regulation 05 of 2026:

> `"(ea) "Application-to-Person call or A2P call" refers to a voice call that is initiated by an application, software system, or automated platform without direct human dialling and delivered to an individual telecom subscriber; including using autodialling, robo-calls and/or pre-recorded/artificial voice technologies;`

A LiveKit Agents worker placing a `CreateSIPParticipant` outbound call is *exactly* this. There is no ambiguity.

> `"4. Intimation regarding use of A2P calls. Every Sender shall declare to the Originating Access Provider (OAP), in advance, about the use of Application-to-Person (A2P) calls, along with the details such as Calling Line Identification (CLI) ranges to be used for making A2P calls, or any other details as specified by the Authority from time to time, and such declaration shall be recorded on the DLT platform by the OAP along with the levels/series/numbering resources assigned to such Sender:`
> `Provided that any such call made by a Sender without prior declaration to the OAP, shall be treated as Unsolicited commercial communication, and the OAP shall take action against such Sender as per the provisions of these regulations."`

Three consequences:
1. You must tell your carrier (via Plivo/Exotel as OAP or their upstream) **before** dialling, in writing, that you are using an automated dialler, what the purpose is, and **which CLIs** you will present.
2. That declaration is **recorded on the DLT platform**. So DLT is in the loop for voice — see §1.4.
3. Skip the declaration and your calls are UCC *by operation of the proviso*, regardless of content or consent.

**[VERIFIED]** New Regulation 35A adds a termination charge: *"The Terminating Access Provider (TAP) may charge the Originating Access Provider (OAP) upto Rs. 0.05 (five paisa only) per minute on per minute pulse basis for A2P calls"*, with no such charge on *"any A2P calls made using number resources assigned from 140xx, 1600xx, 1601xx or any other series designated by the Authority."* Practical effect: **expect roughly ₹0.05/min to be passed through to you** on any A2P call from an ordinary 10-digit number. Whether your provider itemises it or absorbs it is **[UNKNOWN]** — ask in writing.

**[VERIFIED]** TRAI expressly rejected the "there's a human in the loop so it isn't A2P" argument. Its explanatory memo records stakeholders arguing a call with a live human agent shouldn't be A2P, and TRAI's conclusion was that it saw *"no need for any change in proposed definition of A2P calls"*, noting the difficulty of establishing when a human is participating. **Do not rely on a human-initiated-dial workaround as a legal defence without counsel.** (It may still help commercially — see §5.4.)

### 1.3 Promotional vs. service vs. transactional vs. "asking a vendor for a price"

**[VERIFIED]** definitions, as substituted by the Second Amendment (1 of 2025):

- **Promotional Voice Call** — *"commercial communication any voice Commercial Communication containing promotional material or advertisement of a product or service"*, and *"if promotional content is mixed with any type of commercial Voice Call, such voice call shall be treated as a Promotional Voice Call."*
- **Service Voice Call** — a call by a Sender to *"its Customer or Subscriber"* about a product/service they already use, **or** to a Recipient *"to facilitate or complete a commercial transaction involving the ongoing purchase or the use by the Recipient of the product or services offered by the Sender after obtaining Explicit Consent"* — and such explicit consent *"shall be for seven days."*
- **Transactional Voice Call** — a call *"to its Customer or Subscriber in response to Customer initiated transaction within thirty minutes of the transaction"* (OTPs, confirmations).
- **UCC** — *"any commercial communication that is neither as per the consent nor the registered preferences of the Recipient"*, excluding transactional and service calls and government/Authority-directed calls, **with the proviso that unregistered senders' commercial communication is UCC regardless**.

**Where does "AI agent calls a supplier to ask for a price quote" land? [UNCERTAIN — this is the key legal judgement call and needs Indian telecom counsel]**

My reading, and why it is uncomfortable:

- It is **not** a Transactional call (no customer-initiated transaction in the prior 30 minutes).
- It is **not** a Service call (the vendor is not Nivo's "Customer or Subscriber", and Nivo is not the seller in the transaction being facilitated — limb (ii) contemplates the *Recipient* purchasing the *Sender's* product, which is inverted here; and in any case limb (ii) needs Explicit Consent valid for only seven days).
- Whether it is a **Commercial Communication** at all turns on the 2018 definition: *"primary purpose is to inform about or advertise or **solicit business for** ... (B) **a supplier or prospective supplier** of offered goods or services."* A buyer calling a prospective supplier to solicit a quote is soliciting business *involving* a prospective supplier. A narrow reading ("solicit business *for* the supplier" = promoting the supplier) would exclude it. A broad reading, which is how carriers' automated UCC detection will behave, includes it. TRAI's own explanation says intent *"may be inferred from ... the content of the communication"* — and your content is a commercial procurement conversation.
- Even if you win that argument, **it is still an A2P call**, and Regulation 4 says an undeclared A2P call *"shall be treated as Unsolicited commercial communication."* So the A2P declaration duty applies on its own terms; it does not depend on winning the commercial-communication classification debate.

**Plivo states the operational reality bluntly: *"Cold calling is prohibited in India"*, and commercial calls require explicit digital consent beforehand; non-consensual calls are classified as UCC** ([Plivo India calling docs](https://www.plivo.com/docs/voice/concepts/india-calling)). **[VERIFIED — provider doc]**. A first, unsolicited AI call to a vendor whose number you scraped or got from a trade directory is a cold call. That is the honest characterisation of Nivo's use case as described.

**There is no "1:1 business call" carve-out in TCCCPR.** I searched for one and it does not exist. The regulation's exclusions are transactional, service, government, and Authority-directed. **[VERIFIED — by absence in the gazette text]**

### 1.4 Is DLT required for VOICE, or only SMS?

This is the question most commonly answered wrongly on the internet. The precise answer:

**[VERIFIED] Voice is unambiguously inside the TCCCPR/DLT framework, but voice does NOT use the SMS-style Header + Content Template registration.**

- The 2018 definition of Commercial Communication says *"any voice call or message"* — voice is in scope from the start.
- Second Amendment Regulation 3(2): *"No Sender, who is not registered with any Access Provider for the purpose of sending commercial communications under these regulations, shall make any commercial communication, and in case, any such Sender sends commercial communication, all the telecom resources of such Sender may be put under suspension or may also be disconnected."* **Sender registration on DLT is therefore required for commercial voice.**
- Second Amendment Regulation 3(1): commercial communication must use *"registered headers or **the number resources allotted to the Senders from special series assigned for the purpose of commercial communication**"* — headers for SMS, special number series for voice.
- Third Amendment Regulation 4: the A2P declaration *"shall be recorded on the DLT platform by the OAP."* DLT is the system of record for voice A2P.
- The Second Amendment's definition of "Government Voice Call" is conditioned on *"such ... voice calls are made through the DLT platform"* — further confirming DLT carries voice.

**What voice does NOT require:** there is no per-script "content template" approval for live/interactive voice. TRAI explicitly declined to mandate it — its 2025 memo records that *"scrubbing the content on a real time basis is not practical in case of voice calls and should not be mandated."* **[VERIFIED]**

So: **"DLT is SMS-only" is false.** The correct statement is *"DLT entity/Sender registration and A2P declaration apply to voice; DLT header+template registration is an SMS mechanic."* **[VERIFIED]**

### 1.5 Number series: 140 / 1600 / 1601 — and whether Nivo needs one

**[VERIFIED]** From TRAI's 2025 explanatory memo: *"promotional call should be permitted through 140-series numbers only. As far as transactional and service calls are concerned ... DoT has recently allotted 1600 series numbers for making transactional and service calls."* The Third Amendment's Regulation 35A exempts *"140xx, 1600xx, 1601xx"* from the A2P termination charge and (per press coverage) shields them from caller-ID-app blocking.

**[VERIFIED — provider doc]** Plivo's India documentation maps this to what you can actually buy:
- **Landline numbers:** service and transactional calls only
- **140-series:** promotional voice calls exclusively
- **160-series:** BFSI-sector service/transactional calls only

Nivo is not BFSI, so 1600 is out. Nivo's calls are not promotional advertising, so 140 is a poor fit and would also torch answer rates (140 is the "spam" prefix Indian vendors have learned to decline). **This leaves Nivo in an awkward gap: no number series cleanly fits a B2B procurement robocall.** In practice that means an ordinary 10-digit Indian number, which means the ₹0.05/min A2P termination charge applies and the call is maximally exposed to spam-tagging. **[UNCERTAIN — inference from the combination of sources above; confirm with the chosen provider in writing.]**

### 1.6 DNC / NCPR for business numbers

**[UNCERTAIN — secondary sources only; I could not find a TRAI provision that creates a B2B exemption, and I also could not find one that explicitly closes it.]**

- NCPR (National Customer Preference Register, the successor to NDNC) is a **subscriber preference** register, not a consumer-vs-business register. The Preference Register definitions in TCCCPR 2018 speak of "customer", not "individual consumer". **[VERIFIED — from the 2018 text]**
- Practical consequence: **there is no blanket B2B exemption.** Most Indian building-material vendors are proprietorships whose mobile connections are in an individual's name. If that individual has set a "fully blocked" preference, your commercial call to them is UCC. Secondary analysis agrees ([msg91 NCPR guide](https://msg91.com/guide/do-not-call-how-does-dnc-registry-work-in-india), [TRAI UCC FAQ](https://www.trai.gov.in/faqcategory/unsolicited-commercial-communicationsucc)).
- **[VERIFIED]** Second Amendment definition of "Fully blocked": *"stoppage of all types of commercial communication requiring explicit consent except commercial communication sent under inferred consent and Government Message or Government Voice Call."*
- **Operational requirement:** scrub every target list against NCPR through your access provider before dialling. Plivo states it *"supports DLT and DND compliance"*; get the scrubbing mechanism documented before launch. **[UNCERTAIN — mechanism not verified]**

### 1.7 Must you disclose that the caller is an AI?

**[UNCERTAIN → leaning no explicit statutory duty today, but do it anyway]**

- I found **no** provision in TCCCPR 2018, the 2025 Second Amendment, or the 2026 Third Amendment that requires a spoken "this is an automated/AI call" disclosure to the recipient. What the Third Amendment requires is disclosure **to your carrier**, in advance (Regulation 4), not to the called party. **[VERIFIED by reading the gazette text]**
- Secondary commentary anticipates a recipient-facing AI-disclosure duty arriving ([Careerindia summary of the 2026 rules](https://www.careerindia.com/news/trai-anti-spam-rules-2026-compliance-guide-ai-voice-agents-startups-011-65835.html)) but I found no notified rule. Treat those articles as forecasting, not law. **[UNCERTAIN]**
- **No India-specific voice-cloning regulation found. [UNKNOWN]** I did not find a notified Indian rule on synthetic voice cloning applicable to outbound calls. The Third Amendment merely folds *"pre-recorded/artificial voice technologies"* into the A2P definition.
- **Recommendation regardless:** open every call with a plain Hindi/English line identifying the company and that this is an automated assistant, and offer immediate opt-out. It costs three seconds, it is the direction of travel, it materially reduces complaint rate, and complaint rate is what actually gets your trunk disconnected (§1.9). Also note the Third Amendment lowers the complaint threshold for action from 5 to 3 complaints **[UNCERTAIN — from [MediaNama](https://www.medianama.com/2026/09/223-trai-truecaller-140-1600-calls-spam-rules/); I did not locate this clause in the PDF text myself]**.

### 1.8 Must calls originate from an Indian number? CLI rules?

**[VERIFIED] Effectively yes, if you want to reach Indian mobiles with a domestic route.**

- Plivo: *"Only businesses registered in India can"* use domestic routes; foreign businesses *"must route calls internationally, displaying US or international numbers instead"*, and critically **"Both legs of a call must originate and terminate within India"** — violating this produces a `violates_media_anchoring` error ([Plivo India calling docs](https://www.plivo.com/docs/voice/concepts/india-calling)). **This is a direct technical constraint on your LiveKit deployment: your LiveKit SIP media must sit in India (e.g. a Mumbai/ap-south VM), not in a US/EU region.**
- Twilio, conversely: *"Outbound calls to India can only be made from international (non-Indian) numbers"* and domestic caller ID is marked N/A; international CLI must be `+E.164` ([Twilio India Voice Guidelines](https://www.twilio.com/en-us/guidelines/in/voice)). A +1 number calling an Indian hardware distributor will be ignored or assumed to be fraud.
- **CLI spoofing / setting an arbitrary caller ID is not available to you.** Regulation 4 requires you to declare your CLI *ranges* to the carrier; the CLI must be a number resource actually allotted to you.
- Twilio also warns *"High volumes of short-duration calls may trigger automated carrier blocks"* — relevant, since unanswered vendor calls are short. **[VERIFIED]**

### 1.9 Penalties and consequences

Ranked by how likely each is to actually hit Nivo:

1. **Trunk/SIM disconnection and cross-operator blacklisting — MOST LIKELY. [VERIFIED]** Second Amendment Reg. 22(1)(b): once a Sender is suspended or blacklisted by any Access Provider and updated on DLT, *"other Access Providers shall stop traffic from such entities immediately, but not later than twenty-four hours ... and shall not allow re-registration of these entities during the period of suspension or blacklisting."* Reg. 3(2): unregistered senders' *"telecom resources ... may be put under suspension or may also be disconnected."* And the April 2026 data point: 15,736 SIP/PRI disconnections in a single month.
2. **Usage caps and traffic suspension** pending review. **[VERIFIED]**
3. **A2P termination charge pass-through**, ₹0.05/min. **[VERIFIED]**
4. **Financial disincentives** — note carefully: the FD schedule in TCCCPR (₹1,000 / ₹5,000 / ₹10,000 per instance, ₹2 lakh escalating) is levied by TRAI **on Access Providers**, not directly on you. Your carrier's contract will then push that liability onto you and terminate you. **[VERIFIED from the gazette text]**
5. **Telecommunications Act, 2023** — s.28 prohibits "specified messages" without consent; penalties in the Act reach up to ₹2 lakh for operators for UCC breaches, and providing telecom service without authorisation is punishable by up to 3 years and ₹2 crore ([India Code PDF](https://www.indiacode.nic.in/bitstream/123456789/20101/1/A2023-44.pdf); figures via [Trilegal note](https://trilegal.com/wp-content/uploads/2024/07/Trilegal-Update_Government-notifies-sections-of-the-Telecommunications-Act-2023-For-publication-final.pdf)) **[UNCERTAIN — exact section numbering and applicability to a non-licensee like Nivo not verified by me]**. The s.28 exposure is on the operator; the unauthorised-network exposure is the one that would attach to Nivo only if it tried to run its own gateway (see §2).
6. **DPDP Act 2023** — recording vendor calls and storing their numbers is personal data processing. Out of scope for this report but on the checklist. **[UNKNOWN — not researched]**

---

## 2. Is India-origin PSTN even available to a startup?

**Yes, via a licensed provider — and only via a licensed provider.**

- **You may not build your own VoIP-to-PSTN gateway.** The long-standing DoT position is that mixing/merging PSTN and VoIP outside a licence is prohibited as toll bypass. Secondary sources describe bypassing an ILD/NLD licensee's network as toll bypass ([uccollabing summary of DoT/TRAI/OSP rules](https://www.uccollabing.com/dot-trai-regulations-in-india-osp/), [Ozonetel VoIP-in-India guide](https://ozonetel.com/voip-in-india/)). **[UNCERTAIN — I did not retrieve the underlying DoT circular; treat the prohibition as real and do not test it.]** Under the Telecommunications Act 2023, establishing a telecom network without authorisation carries criminal exposure. **This is the single thing that could end the company rather than the feature.**
- **The OSP route is no longer the obstacle it was.** DoT's revised OSP Guidelines (June 2021) removed OSP registration requirements and removed the domestic/international OSP distinction, permitting interconnection of voice between OSP centres and with unrelated companies ([Trilegal update PDF](https://trilegal.com/wp-content/uploads/2021/11/New-Guidelines-for-Other-Service-Providers-OSPs.pdf); [BTG Advaya note](https://www.btgadvaya.com/post/dot-revised-other-service-provider-osp-guidelines)). **[UNCERTAIN — secondary, but consistent across several law-firm sources.]** **Practical read: Nivo does not need OSP registration. It needs a licensed carrier partner.**
- **What a provider actually requires of you (Plivo, as the best-documented case): [VERIFIED]**
  - An **Indian registered entity** — *"Only businesses registered in India can"* rent Indian numbers / use domestic routes
  - **Certificate of Incorporation** (MCA) or **Udyam** (MSME) registration
  - **Business PAN or GST certificate** (both COI and PAN/GST described as mandatory for number rental)
  - **An INR bank account** (Plivo bills an India entity in INR)
  - KYC approval before number rental; Plivo's support material indicates voice KYC turnaround of roughly **1 hour to 1 business day** **[UNCERTAIN — from search-result summary of [Plivo support](https://support.plivo.com/hc/en-us/articles/36749835402905-What-is-the-process-for-renting-a-local-number-in-India), not read directly]**
  - Address proof within a valid telecom district is explicitly required by Telnyx; **[UNKNOWN]** whether Plivo requires the same.

---

## 3. Provider comparison

Criteria: (a) works with **self-hosted** LiveKit SIP via standard SIP credentials/IP auth, (b) India **domestic outbound**, (c) onboarding friction, (d) published pricing, (e) minimum commitment.

### Twilio — **Rejected for this use case**
- **Self-hosted LiveKit:** Yes, standard Elastic SIP Trunking; LiveKit documents Twilio as a supported provider.
- **India outbound:** **Only from non-Indian numbers.** *"Outbound calls to India can only be made from international (non-Indian) numbers."* Twilio's own India SIP trunking pricing page states *"we don't have voice enabled numbers in this locale."* ([Twilio India Voice Guidelines](https://www.twilio.com/en-us/guidelines/in/voice), [Twilio SIP Trunking Pricing India](https://www.twilio.com/en-us/sip-trunking/pricing/in))
- **Verdict:** a US CLI calling an Indian cement distributor will not be answered, and it forfeits the domestic-route compliance posture entirely. Also *"Voice OTP/2FA is not permitted and may be blocked."* **Do not use Twilio for Nivo's India outbound.**

### Plivo — **PRIMARY RECOMMENDATION**
- **Self-hosted LiveKit:** Explicitly yes. *"Plivo trunks speak standard SIP, so they work the same whether you self-host LiveKit or run it on LiveKit Cloud."* Plivo ships an official LiveKit quickstart covering inbound and outbound trunks. ([Plivo × LiveKit](https://www.plivo.com/livekit/), [Plivo LiveKit SIP quickstart](https://www.plivo.com/docs/sip-trunking/Livekit))
- **India outbound:** Yes, domestic. Plivo keeps media in-country, bills in INR to an India entity, and states support for DLT and DND compliance. ([Plivo × LiveKit](https://www.plivo.com/livekit/))
- **Friction:** Indian entity + COI/Udyam + PAN/GST + INR account + KYC. Real, but the lightest of the compliant options.
- **Pricing:** published (see §4).
- **Minimum commitment:** *"No per-channel fees, minimum spend, or contracts."* ([Plivo × LiveKit](https://www.plivo.com/livekit/)) — decisive for a cost-sensitive pilot.
- **Constraint to design for:** *"Both legs of a call must originate and terminate within India"* — host LiveKit + LiveKit SIP in an Indian region.

### Exotel — **FALLBACK**
- **Self-hosted LiveKit:** Yes, via Virtual SIP Trunking (vSIP), **IP-whitelist auth** (static IP required), and their guide explicitly references LiveKit: *"Set trunk_external_alias for VN–FQDN mapping if required (for VAPI, LiveKit, etc.)"* ([Exotel vSIP configuration guide](https://support.exotel.com/support/solutions/articles/3000133452-flow-and-api-configuration-guide-for-voice-ai-contact-centre-platforms-via-exotel-virtual-sip-trunk))
- **India outbound:** Yes — Exotel operates its own **UL-VNO** licence, which is the strongest compliance posture available to you. Also offers AgentStream for low-latency AI media.
- **Friction:** Highest. Sales-led, IP whitelisting approval, prepaid plan purchase.
- **Pricing:** **per-minute outbound rates are NOT published — requires sales contact.** The published plans are bundled prepaid credit packages (see §4).
- **Minimum commitment:** effectively yes — the entry plan is a ₹9,999 prepaid bundle.

### Telnyx — **Viable but unverified on price**
- **Self-hosted LiveKit:** Yes, LiveKit documents Telnyx support.
- **India outbound:** Yes — Telnyx now offers Indian **mobile** numbers with two-way voice, but only in **Mumbai City, Gurugram, Noida, Bangalore**, and *"businesses must provide a valid business or residential address within one of the four authorized telecom districts and complete the required KYC verification."* ([Telnyx India mobile numbers release note](https://telnyx.com/release-notes/india-mobile-numbers))
- **Pricing:** **India per-minute rates — not published on that page; requires account/sales contact. [UNKNOWN]**
- **Note:** an Indian *mobile* CLI is arguably the best possible answer-rate asset for calling a hardware shop. Worth a quote request even though it isn't the primary pick.

### Vonage — **Insufficient information; not recommended**
- Vonage maintains country-specific restriction docs but I could not retrieve India specifics ([Vonage country-specific restrictions index](https://api.support.vonage.com/hc/en-us/sections/200637656-Country-Specific-Features-and-Restrictions)). **[UNKNOWN]** No India advantage identified over Plivo/Exotel.

### Knowlarity / Ozonetel — **Wrong shape**
- Both are contact-centre/CPaaS platforms rather than raw SIP trunk vendors; both are enterprise sales-led.
- **Ozonetel per-minute India outbound pricing: not published — requires sales contact** ([Ozonetel Asia pricing page](https://ozonetel.com/pricing-asia/)). **[VERIFIED that it is unpublished]**
- **Knowlarity per-minute India outbound pricing: [UNKNOWN]**
- Neither has a documented self-hosted-LiveKit SIP path. Skip at pilot scale.

### Acefone / Servetel, Airtel IQ, Tata Communications — **Enterprise-only at this stage**
- Acefone's India pricing page returned HTTP 404 on 2026-09-23; **pricing [UNKNOWN]**.
- Airtel IQ and Tata Communications are custom-quoted enterprise SIP; secondary sources state they price on concurrent calls/seats/volume ([Acefone cloud telephony roundup](https://www.acefone.com/blog/cloud-telephony-providers/)). **[UNCERTAIN]**
- These are the right answer at hundreds of thousands of minutes/month, not at tens of calls/month. Revisit at scale.

### LiveKit Cloud's own telephony — **Does not cover India**
- **[VERIFIED]** *"Available only in the US. Support for additional countries is coming in a future release."* ([LiveKit Phone Numbers docs](https://docs.livekit.io/sip/cloud/phone-numbers/))
- LiveKit's India guidance is to bring your own local trunk: it names **Plivo, Twilio, Exotel**, offers a **Mumbai (ap-south)** agent region, an **India SIP endpoint**, and region pinning on request, and notes *"all telephony calls are subject to further Department of Telecommunications (DoT) data residency requirements"* ([LiveKit: Building Performant Voice Agents in India](https://livekit.com/blog/building-performant-voice-agents-india)).
- **Conclusion:** LiveKit Cloud would **not** simplify India telephony — you would still need Plivo/Exotel for the number and the route. It *could* simplify the media-in-India requirement via ap-south + region pinning. Since the stack is already self-hosted and working, **staying self-hosted is correct**; just make sure the SIP/media node is in an Indian region.

---

## 4. Pricing — only what is actually published

All figures below were read off the provider's own pricing page on **2026-09-23**. Nothing here is estimated. Where a price is not published, it says so.

### Plivo — India (INR, India-specific) [VERIFIED]
Source: [Plivo India Voice Pricing](https://www.plivo.com/voice/pricing/in/) and [Plivo India SIP Trunking Pricing](https://www.plivo.com/sip-trunking/pricing/in/)

| Item | Published price | Notes |
|---|---|---|
| Outbound, domestic India | **₹0.38 / min** | Single rate; page does not distinguish mobile vs landline |
| Inbound, domestic India | **₹0.38 / min** | |
| India local number rental | **₹200 / month** | |
| Billing pulse | **30 seconds** | |
| Secure trunking add-on | **₹0.00 / min** | |
| Short code | **$1,500 one-time** | Not relevant to Nivo |
| Call recording | **₹0.81 / min** | |
| ASR | **₹1.70 per 15 seconds** | Use your own STT instead |
| Setup fee / minimum spend | **None stated**; Plivo states "No per-channel fees, minimum spend, or contracts" | |

### Twilio — India [VERIFIED, but India-terminating from international routes]
Source: [Twilio SIP Trunking Pricing India](https://www.twilio.com/en-us/sip-trunking/pricing/in), [Twilio Voice Pricing India](https://www.twilio.com/en-us/voice/pricing/in)

| Item | Published price |
|---|---|
| SIP termination — India (general / major cities) | **$0.0659 / min** |
| SIP termination — India mobile | **$0.0456 / min** |
| Programmable Voice — India major cities | **$0.0699 / min** |
| Programmable Voice — India mobile | **$0.0496 / min** |
| SIP interface leg | **$0.0040 / min** |
| Call recording | **$0.0025 / min** |
| Recording storage | **$0.0005 / min / month** |
| India voice-enabled phone number | **Not available** — page states "we don't have voice enabled numbers in this locale" |

*Note: at ~₹88/USD these India-mobile rates are roughly an order of magnitude above Plivo's domestic ₹0.38/min, on top of being non-compliant-by-design for Nivo's CLI needs. (Currency conversion is mine, not a published figure.)*

### Exotel — India [VERIFIED that per-minute rates are unpublished]
Source: [Exotel Business Phone System Pricing](https://exotel.com/pricing/business-phone-system/)

| Item | Published price |
|---|---|
| Dabbler plan | **₹9,999** — 5 months validity, ₹4,999 rental, 5,000 credits, 1 virtual number, 3 agents |
| Believer plan | **₹19,999** — 11 months, ₹10,499 rental, 9,500 credits, 2 numbers, 6 agents |
| Influencer plan | **₹49,499** — 11 months, ₹10,499 rental, 39,000 credits, 10 numbers, unlimited agents |
| SMS | from **₹0.18** per SMS at 100k+ volume |
| **Per-minute outbound voice rate** | **NOT PUBLISHED — requires sales contact** |
| **vSIP trunk setup fee** | **NOT PUBLISHED — requires sales contact** |

> Widely circulated third-party figures of "₹0.60–₹1.50/min for Exotel" appear only on comparison blogs, not on Exotel's own site. **I am not reporting them as prices.** Get a written quote.

### Telnyx — India
- **Per-minute India rates: NOT PUBLISHED on the India release note — requires account signup or sales contact.** **[UNKNOWN]**

### Ozonetel, Knowlarity, Acefone/Servetel, Airtel IQ, Tata Communications
- **All: per-minute India outbound rates NOT PUBLISHED — require sales contact.** Acefone's India pricing URL 404'd on 2026-09-23. **[UNKNOWN]**

### Regulatory cost line item
- **A2P termination charge: up to ₹0.05/min**, per Regulation 35A of TRAI Regulation 05 of 2026. **[VERIFIED as a regulatory ceiling.]** Whether and how your provider passes this through is **[UNKNOWN]** — ask before signing.

### What a pilot actually costs (arithmetic on published Plivo figures only)
100 calls × 4 minutes = 400 minutes.
- Call charges: 400 × ₹0.38 = **₹152**
- Number rental: **₹200/month**
- Worst-case A2P termination pass-through: 400 × ₹0.05 = **₹20**
- **Telephony ≈ ₹372/month.**

**The telephony bill is trivial. The compliance work is the entire cost of this feature.** That asymmetry should drive the decision in §5.

---

## 5. Recommendation

### 5.1 Primary: Plivo India domestic trunk + self-hosted LiveKit in an Indian region

**Why:**
- The only provider in this comparison that publishes a real India per-minute rate (₹0.38/min), states **no minimum spend or contract**, and ships an **official LiveKit quickstart that explicitly covers self-hosted LiveKit**.
- Bills in INR to an India entity, keeps media in-country, and states DLT/DND compliance support — which is exactly the posture the A2P regime demands.
- KYC is document-based and reportedly fast, versus Exotel's sales-led onboarding.
- Exit cost is near zero if the feature is killed.

**Why not the others:** Twilio structurally cannot give you an Indian CLI. LiveKit Cloud has no India numbers. Ozonetel/Knowlarity/Airtel/Tata publish nothing and sell to enterprises. Telnyx is plausible but unpriced and geographically restricted to four districts.

### 5.2 Fallback: Exotel vSIP

Switch to Exotel if (a) Plivo declines the AI-agent use case on KYC review, (b) you need the stronger UL-VNO licensing story for an enterprise customer, or (c) you need AgentStream-grade media latency. Accept: sales cycle, IP whitelisting, a ₹9,999+ prepaid commitment, and unpublished per-minute pricing.

### 5.3 Concrete next steps, in order

**Phase 0 — decide whether to do this at all (1 day).** Re-read §0 and §5.4. If the pilot is tens of calls/month, seriously consider 5.4 first.

**Phase 1 — Legal (start immediately; this is the long pole).**
1. **Engage Indian telecom counsel** for a written opinion on one question: *does a B2B outbound AI call to a prospective supplier requesting a price quote constitute "Commercial Communication" under TCCCPR 2018 reg. 2, and what is the compliant minimum?* Budget for this. Everything downstream depends on the answer. **Do not launch on my §1.3 analysis alone.**
2. Confirm with counsel the recipient-facing AI-disclosure position and DPDP obligations for call recording.

**Phase 2 — Entity & documents (parallel with Phase 1).**
3. Gather: Certificate of Incorporation (MCA) **or** Udyam/MSME registration; business PAN; **GST certificate**; Indian bank account in the entity's name; registered address proof; authorised signatory ID.
4. If no Indian entity/GST exists yet, this alone is weeks. It gates everything.

**Phase 3 — Provider onboarding.**
5. Open a Plivo account, submit India voice KYC, rent one India local number (₹200/mo).
6. **In writing, ask Plivo:** (a) is a conversational AI agent calling B2B suppliers an approved use case on a domestic India route? (b) how do you submit the Regulation 4 A2P pre-declaration and CLI ranges? (c) how is NCPR/DND scrubbing performed? (d) is the ₹0.05/min A2P termination charge passed through? **Keep the written answers.** If they cannot answer (b), you have no compliant path with them.
7. Register as a **Sender** with the Originating Access Provider on the DLT platform (Reg. 3(2)).
8. File the **A2P declaration** with CLI ranges (Reg. 4) and get written confirmation it is recorded on DLT.

**Phase 4 — Technical.**
9. Move/confirm self-hosted LiveKit + LiveKit SIP media in an **Indian region** (Mumbai/ap-south) — required by Plivo's both-legs-in-India media anchoring.
10. Configure the Plivo outbound trunk against the LiveKit quickstart; verify with one test call to your own number.
11. Build in, before any vendor is dialled: NCPR/DND scrub step; **09:00–21:00 IST dialling window**; AI-identity disclosure in the opening line (Hindi + English); immediate opt-out honoured and persisted; per-call audit log of consent basis, declaration reference, and outcome; hard rate limit and a kill switch. Avoid bursts of short-duration calls (carrier block trigger).
12. Prefer **consented** targets: vendors Nivo already transacts with, or who opted in via a Nivo web form. That is your strongest defence and the best answer rate.

**Phase 5 — Pilot.** Start at <20 calls/day. Monitor answer rate, complaint signals, and spam-tagging. Any disconnection notice → stop everything and go back to counsel.

### 5.4 Realistic timeline, blockers, and the alternatives I would actually pick first

**Timeline to first legal outbound call:**
- Indian entity + GST already in hand: **3–6 weeks** (counsel opinion 1–2 wks ∥ KYC days ∥ DLT sender registration + A2P declaration 1–3 wks, carrier-dependent ∥ engineering ~1 wk).
- Entity/GST not in hand: **add 4–10 weeks.**
- **[UNCERTAIN]** — DLT sender registration and A2P declaration turnaround for a non-BFSI startup is not published anywhere I could find. This is the largest schedule unknown.

**What could block it entirely:**
1. **No Indian entity with GST → hard stop.** No compliant domestic India CLI exists without it.
2. **Counsel concludes the calls are Promotional Voice Calls** → you would be pushed to the 140 series with prior explicit consent, which destroys both the economics and the answer rate. Feature dead in this form.
3. **Provider refuses the use case on KYC review.** "AI agent cold-calls suppliers" is precisely what carriers are disconnecting SIP trunks for. Plausible.
4. **No workable A2P declaration path at your provider** for a small non-BFSI sender.
5. **Rules keep tightening.** Three amendments in 19 months, all in one direction. Anything you build here needs ongoing compliance ownership, and Nivo does not have a compliance function.

**Alternatives I would pick first at pilot scale — ranked:**

1. **Vendor-initiated inbound (best risk/effort ratio).** Nivo publishes one Indian number; vendors call *in* to quote rates. Inbound is not a commercial communication, is not A2P, needs no DND scrub and no Reg. 4 declaration. Same LiveKit agent, ~10% of the legal surface. Plivo inbound is the same ₹0.38/min. **Recommended starting point.**
2. **Click-to-call opt-in from a web link.** Vendor clicks "Get a call from Nivo" on a page; that click is timestamped explicit digital consent, and the call is arguably a Service Voice Call under the 2025 limb (ii) — noting explicit consent there is valid for **seven days** only, so the call must go out fast. Still A2P; still declare under Reg. 4. **[UNCERTAIN — classification needs counsel.]**
3. **Human-initiated warm transfer.** A Nivo operator dials manually and hands off to the AI once the vendor engages. **Caveat: TRAI expressly declined to exclude human-involved calls from the A2P definition** (§1.2), so do not sell this internally as a legal exemption — it is a *commercial* mitigation (better answer rates, human judgement on consent) with an *uncertain* legal benefit.
4. **WhatsApp Business.** Indian building-material vendors already quote rates on WhatsApp all day. This is how the market actually works. It sits under Meta's policy plus DPDP rather than TCCCPR/A2P, and Exotel publishes WhatsApp conversation pricing (Utility **₹0.115**, Service **free**, per-message fee **₹0.06** — [Exotel pricing](https://exotel.com/pricing/business-phone-system/), 2026-09-23). **For "collect material rates from vendors", this is very likely the highest-ROI channel and the lowest-risk one.** Voice-note transcription gets you most of the AI value. **[UNCERTAIN — WhatsApp Business template/opt-in rules not researched here.]**
5. **Do it manually for the pilot.** At tens of calls/month, a human making the calls and typing rates into Nivo costs less than the legal opinion. Automate once the data proves the feature matters.

**My honest recommendation:** build **(1) inbound + (4) WhatsApp** now, and treat outbound AI dialling as a Phase 2 project to be started only when (a) an Indian entity with GST exists, (b) counsel has given a written opinion, and (c) volume justifies the compliance function. The published telephony cost of outbound is ₹372/month for the pilot. The real cost is a legal opinion, a DLT registration, an ongoing compliance owner, and non-trivial odds of a carrier blacklist attached to Nivo's PAN. That trade is not worth it for tens of calls a month.

---

## Appendix: sources

**Primary — regulation**
- TCCCPR 2018 (6 of 2018), principal regulation — https://trai.gov.in/sites/default/files/2025-01/RegulationUcc19072018.pdf
- TCCCPR (Second Amendment) Regulations, 2025 (1 of 2025), 12 Feb 2025 — https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf
- TCCCPR (Third Amendment) Regulations, 2026 (05 of 2026), 18 Sep 2026 — https://trai.gov.in/sites/default/files/2026-09/Regulation_18092026.pdf
- TRAI regulations index — https://trai.gov.in/release-publication/regulations
- TRAI TCCCPR landing page — https://trai.gov.in/tcccpr
- TRAI UCC FAQ — https://www.trai.gov.in/faqcategory/unsolicited-commercial-communicationsucc
- TRAI advice to Senders — https://trai.gov.in/advice-to-senders
- Telecommunications Act, 2023 — https://www.indiacode.nic.in/bitstream/123456789/20101/1/A2023-44.pdf
- DoT 1600-series PIB release (403 on fetch; metadata only) — https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2022249&reg=48&lang=2

**Primary — providers**
- Plivo India calling requirements — https://www.plivo.com/docs/voice/concepts/india-calling
- Plivo India voice pricing — https://www.plivo.com/voice/pricing/in/
- Plivo India SIP trunking pricing — https://www.plivo.com/sip-trunking/pricing/in/
- Plivo × LiveKit — https://www.plivo.com/livekit/
- Plivo LiveKit SIP quickstart — https://www.plivo.com/docs/sip-trunking/Livekit
- Twilio India voice guidelines — https://www.twilio.com/en-us/guidelines/in/voice
- Twilio India SIP trunking pricing — https://www.twilio.com/en-us/sip-trunking/pricing/in
- Twilio India voice pricing — https://www.twilio.com/en-us/voice/pricing/in
- Exotel vSIP configuration guide — https://support.exotel.com/support/solutions/articles/3000133452-flow-and-api-configuration-guide-for-voice-ai-contact-centre-platforms-via-exotel-virtual-sip-trunk
- Exotel pricing — https://exotel.com/pricing/business-phone-system/
- Telnyx India mobile numbers — https://telnyx.com/release-notes/india-mobile-numbers
- LiveKit Phone Numbers (US-only) — https://docs.livekit.io/sip/cloud/phone-numbers/
- LiveKit: voice agents in India — https://livekit.com/blog/building-performant-voice-agents-india
- Ozonetel Asia pricing (unpublished rates) — https://ozonetel.com/pricing-asia/

**Secondary — flagged as such in-text**
- Trilegal, revised OSP guidelines — https://trilegal.com/wp-content/uploads/2021/11/New-Guidelines-for-Other-Service-Providers-OSPs.pdf
- Trilegal, Telecommunications Act notification — https://trilegal.com/wp-content/uploads/2024/07/Trilegal-Update_Government-notifies-sections-of-the-Telecommunications-Act-2023-For-publication-final.pdf
- BTG Advaya, revised OSP guidelines — https://www.btgadvaya.com/post/dot-revised-other-service-provider-osp-guidelines
- uccollabing, DoT/TRAI/OSP VoIP-PSTN — https://www.uccollabing.com/dot-trai-regulations-in-india-osp/
- Ozonetel, VoIP in India — https://ozonetel.com/voip-in-india/
- MediaNama, Sept 2026 amendment — https://www.medianama.com/2026/09/223-trai-truecaller-140-1600-calls-spam-rules/
- TechCrunch, Sept 2026 amendment — https://techcrunch.com/2026/09/18/india-forces-caller-id-apps-to-feed-spam-reports-to-telcos/
- msg91, NCPR/DND guide — https://msg91.com/guide/do-not-call-how-does-dnc-registry-work-in-india
- Careerindia, 2026 AI-voice compliance summary — https://www.careerindia.com/news/trai-anti-spam-rules-2026-compliance-guide-ai-voice-agents-startups-011-65835.html

**Not a substitute for Indian telecom counsel.** Regulations verified against gazette text as of 2026-09-23; the Third Amendment's 60- and 90-day provisions had not yet commenced at that date.
