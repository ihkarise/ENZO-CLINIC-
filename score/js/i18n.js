/**
 * Every visible word of the Gut Health Score, in English (en) and
 * Malayalam (ml). Both languages must have exactly the same keys (tested).
 * Change only the text between the quote marks.
 */
export const TEXT = {
  en: {
    product: 'ENZO Gut Health Score™',
    skip: 'Skip to content',
    back: 'Back',
    langSwitch: 'Language',

    /* intro */
    introH: 'How healthy is your gut?',
    introLead: 'Discover your digestive symptom pattern in just 2 minutes.',
    facts: ['8 questions', 'About 2 minutes', 'Symptoms over the past 14 days', 'Educational assessment, not a diagnosis'],
    start: 'Start Your Assessment',
    introNote1: 'Your answers help describe reported symptoms. The assessment cannot diagnose or rule out disease.',
    introNote2: 'Your answers stay on this device while you complete the assessment. Nothing is saved or sent to the clinic unless you choose to send your result on WhatsApp at the end.',
    disclaimerH: 'Disclaimer',
    disclaimer: 'The ENZO Gut Health Score™ is an educational symptom-assessment tool developed by ENZO Homoeo Medical Centre. It is not a clinically validated diagnostic instrument and cannot diagnose or rule out any medical condition. Results are based on self-reported symptoms during the previous 14 days and should not replace professional medical evaluation. Persistent, severe or concerning symptoms require assessment by a qualified healthcare professional. The score does not establish the cause of symptoms or determine the suitability of any particular treatment.',

    /* questions */
    qLabel: (i, n) => `Question ${i} of ${n}`,
    progress: 'Assessment progress',
    prev: 'Previous',
    next: 'Continue',
    errAnswer: 'Please choose one answer to continue.',
    questions: {
      q1: { title: 'Bloating', text: 'During the past 14 days, on how many days have you experienced bloating or a feeling of fullness in your abdomen?' },
      q2: { title: 'Gas and abdominal discomfort', text: 'During the past 14 days, on how many days have you experienced troublesome gas, excessive burping or abdominal discomfort?' },
      q3: { title: 'Acidity and reflux', text: 'During the past 14 days, on how many days have you experienced heartburn, acid reflux or a burning sensation in your chest or upper abdomen?' },
      q4: { title: 'Abdominal pain', text: 'During the past 14 days, on how many days have you experienced abdominal pain or cramps?' },
      q5: { title: 'Bowel regularity', text: 'During the past 14 days, on how many days have you experienced constipation, hard stools, loose stools or difficulty maintaining your usual bowel pattern?',
            help: 'Select the frequency of the days on which any of these problems occurred.' },
      q6: { title: 'Incomplete bowel movement', text: 'During the past 14 days, on how many days have you felt that your bowel movement was incomplete after passing stool?' },
      q7: { title: 'Food-related symptoms', text: 'During the past 14 days, on how many days have you noticed digestive symptoms after eating a meal or particular food?' },
      q8: { title: 'Impact on daily life', text: 'During the past 14 days, how often have digestive symptoms interfered with your work, daily activities, sleep or overall comfort?' }
    },
    options: {
      days: [
        { label: 'Never', detail: '0 days' }, { label: 'Rarely', detail: '1–2 days' },
        { label: 'Sometimes', detail: '3–6 days' }, { label: 'Frequently', detail: '7–14 days' }
      ],
      freq: [
        { label: 'Never', detail: '' }, { label: 'Rarely', detail: '' },
        { label: 'Sometimes', detail: '' }, { label: 'Frequently', detail: '' }
      ]
    },

    /* warning signs */
    finalCheck: 'Final safety check',
    finalCheckEyebrow: 'Final safety check · not part of your score',
    warnH: 'Before we show your result',
    warnQ: 'Have you experienced any of the following?',
    warnHelp: 'Select all that apply. These answers do not change your score.',
    warnings: {
      blood: 'Blood in my stool or vomit',
      blackStool: 'Black, tarry stools',
      weightLoss: 'Unexplained weight loss',
      vomiting: 'Persistent vomiting',
      swallowing: 'Difficulty or pain while swallowing',
      severePain: 'Severe or persistent abdominal pain',
      swelling: 'Significant or persistent abdominal swelling',
      jaundice: 'Yellowing of the eyes or skin',
      chest: 'Chest pain or breathing difficulty',
      none: 'None of the above'
    },
    showResult: 'Show my result',
    errWarn: 'Please select any that apply, or “None of the above”.',
    urgentNowLead: 'If this is happening now or is severe, do not wait.',
    urgentNow: n => `Call ${n} or go to the nearest emergency department.`,

    /* results */
    resultH: 'Your result',
    totalAria: (t, m) => `Total score ${t} out of ${m}`,
    scoreRange: (a, b) => `Score ${a}–${b}`,
    bands: {
      low: { label: 'Low reported symptom burden',
        interpretation: 'Your responses indicate relatively few digestive symptoms during the past 14 days.',
        nextStep: 'Maintain healthy routines and monitor any symptoms that develop or persist.' },
      mild: { label: 'Mild digestive concerns',
        interpretation: 'You have reported some digestive symptoms that may occur occasionally or around particular meals.',
        nextStep: 'Track symptoms and meal patterns. Seek advice if symptoms persist or worsen.' },
      moderate: { label: 'Moderate reported symptoms',
        interpretation: 'Your responses indicate a more noticeable burden of digestive symptoms.',
        nextStep: 'Consider a healthcare professional’s assessment, particularly if symptoms interfere with daily life.' },
      high: { label: 'High reported symptom burden',
        interpretation: 'You have reported frequent digestive symptoms or substantial symptom-related impact.',
        nextStep: 'Arrange a medical evaluation to understand possible causes and appropriate treatment.' }
    },
    bandNote: 'A low score does not rule out disease, and a high score does not automatically indicate a serious condition. Score bands are proposed educational categories and have not been clinically validated.',
    profileH: 'Your symptom profile',
    subscores: {
      bloatingGas: 'Bloating and gas', acidity: 'Acidity and reflux', pain: 'Abdominal pain',
      bowel: 'Bowel function', food: 'Food-related symptoms', impact: 'Daily-life impact'
    },
    outOf: (s, m) => `${s} out of ${m}`,
    rawNote: 'These are raw scores. Bloating and gas and Bowel function each combine two questions (out of 6); the other areas are single questions (out of 3). Comparing them does not establish medical priority.',
    topH: 'Your highest-scoring symptom areas',
    tieNote: n => `${n} areas share the highest raw score.`,
    noElevated: 'No elevated symptom category was identified by these responses.',
    reportedH: 'What you reported',
    expNone: 'You reported none of the eight listed digestive symptoms during the past 14 days.',
    expPart: (title, label, detail) => `${title.toLowerCase()} — ${label.toLowerCase()}${detail ? ` (${detail})` : ''}`,
    expLine: (area, s, m, parts) => `${area} scored ${s} out of ${m}. You reported: ${parts}.`,
    expImpact: freq => `You also reported that digestive symptoms interfered with your daily life ${freq.toLowerCase()}.`,
    warnResH: 'Warning-sign check',
    noWarnings: 'None of the listed warning signs were reported in this assessment.',
    noWarningsTail: 'If you develop any warning signs, or symptoms become severe, seek medical care promptly.',
    nextH: 'Suggested next step',
    followSafety: 'First, follow the safety guidance at the top of this page.',

    /* safety panel */
    youReported: 'You reported:',
    urgentH: 'Seek emergency medical assessment',
    urgentLead: 'Some of these signs need urgent medical attention.',
    urgentBody: 'If you have them now, or your symptoms are severe or getting worse, go to the nearest emergency department or call emergency services immediately. Do not wait for an online form, this result or a clinic reply.',
    urgentOthers: 'The other signs you selected also need prompt assessment by a doctor.',
    urgentFoot: 'This tool cannot tell whether a warning sign is serious or harmless. Your symptom score below does not change this advice.',
    promptH: 'Please arrange a medical evaluation soon',
    promptLead: 'These signs should be assessed by a doctor in a timely way, whatever your symptom score.',
    promptBody: 'If they are sudden, severe or getting worse, seek emergency care.',
    promptFoot: 'This tool cannot tell whether a warning sign is serious or harmless.',
    call: n => `Call ${n}`,
    emergencyLabel: 'National emergency number (India)',

    /* WhatsApp lead card */
    waEyebrow: 'How did you score?',
    waH: 'Contact your doctor and know your score',
    waBody: 'Send your result to the doctor on WhatsApp with one tap, and ask what can be done about it.',
    waBtn: 'Send my score on WhatsApp',
    waNote: 'Opens WhatsApp with your score already typed. You can read or change the message before sending. Replies are not instant.',
    waUrgent: n => `If you have an urgent warning sign, call ${n} first. Do not wait for a WhatsApp reply.`,
    msg: {
      hello: 'Hello Doctor,',
      done: 'I just completed the ENZO Gut Health Score™.',
      score: (t, m, band) => `*My score: ${t}/${m} – ${band}*`,
      top: 'Highest areas',
      topNone: 'Highest areas: none elevated',
      areas: 'Area scores',
      warn: 'Warning signs ticked',
      warnNone: 'Warning signs: none of the listed signs',
      ask: 'Can we do something about this? Please tell me more.',
      book: 'I would like to book a consultation.'
    },

    /* consultation CTA */
    ctaH: 'Want to understand your digestive symptoms better?',
    ctaBody: 'A personalised assessment can help explore your symptoms, medical history and whether further investigations or specialist evaluation are appropriate.',
    ctaBtn: 'Book a Consultation',
    ctaFallback: 'To book a consultation, please contact ENZO Homoeo Medical Centre directly.',

    /* privacy + actions */
    privacyH: 'Your answers',
    privacy1: 'Your result has not been saved. It exists only in this browser tab and is cleared when you close the tab or start again. The clinic only receives it if you send it with the WhatsApp button.',
    privacy2: 'You can also print this page and bring it to your consultation.',
    print: 'Print result',
    restart: 'Start again',
    printed: (v, d) => `ENZO Gut Health Score™ v${v} · printed ${d}`,

    /* footer */
    footerNote: 'Educational symptom assessment. It cannot diagnose or rule out any medical condition. In an emergency, contact emergency services.',
    footerWa: 'Chat on WhatsApp',
    footerBook: 'Book a consultation',
    footerPrivacy: 'Privacy'
  },

  ml: {
    product: 'ENZO Gut Health Score™',
    skip: 'ഉള്ളടക്കത്തിലേക്ക് പോകുക',
    back: 'പിന്നോട്ട്',
    langSwitch: 'ഭാഷ',

    introH: 'നിങ്ങളുടെ കുടലിന്റെ ആരോഗ്യം എങ്ങനെയാണ്?',
    introLead: 'വെറും 2 മിനിറ്റിനുള്ളിൽ നിങ്ങളുടെ ദഹനസംബന്ധമായ ലക്ഷണങ്ങളെക്കുറിച്ച് മനസ്സിലാക്കാം.',
    facts: ['8 ചോദ്യങ്ങൾ', 'ഏകദേശം 2 മിനിറ്റ്', 'കഴിഞ്ഞ 14 ദിവസത്തെ ലക്ഷണങ്ങൾ അടിസ്ഥാനമാക്കി', 'ബോധവൽക്കരണത്തിനുള്ള വിലയിരുത്തൽ മാത്രം; രോഗനിർണയമല്ല'],
    start: 'വിലയിരുത്തൽ ആരംഭിക്കുക',
    introNote1: 'നിങ്ങൾ നൽകുന്ന ഉത്തരങ്ങൾ നിങ്ങളുടെ ലക്ഷണങ്ങളുടെ സ്വഭാവം മനസ്സിലാക്കാൻ സഹായിക്കും. ഈ വിലയിരുത്തലിലൂടെ രോഗം സ്ഥിരീകരിക്കാനോ ഇല്ലെന്ന് ഉറപ്പാക്കാനോ കഴിയില്ല.',
    introNote2: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ ഈ ഉപകരണത്തിൽ വിലയിരുത്തൽ പൂർത്തിയാക്കുന്ന സമയത്തോളം മാത്രമേ നിലനിൽക്കൂ. അവസാനം നിങ്ങൾ WhatsApp വഴി അയയ്ക്കാൻ തീരുമാനിച്ചാലല്ലാതെ, അവ സേവ് ചെയ്യുകയോ ക്ലിനിക്കിലേക്ക് അയയ്ക്കുകയോ ചെയ്യുന്നില്ല.',
    disclaimerH: 'പ്രധാന അറിയിപ്പ്',
    disclaimer: 'ENZO Gut Health Score™ ദഹനസംബന്ധമായ ലക്ഷണങ്ങളെക്കുറിച്ചുള്ള ബോധവൽക്കരണത്തിനായി ENZO Homoeo Medical Centre തയ്യാറാക്കിയ വിലയിരുത്തൽ ഉപകരണമാണ്. ഇത് ക്ലിനിക്കൽ പരിശോധനകളിലൂടെ സാധൂകരിച്ച രോഗനിർണയ ഉപകരണമല്ല. രോഗം സ്ഥിരീകരിക്കാനോ ഇല്ലെന്ന് ഉറപ്പാക്കാനോ ഇതിന് കഴിയില്ല. കഴിഞ്ഞ 14 ദിവസത്തെ സ്വയം റിപ്പോർട്ട് ചെയ്ത ലക്ഷണങ്ങളെ അടിസ്ഥാനമാക്കിയുള്ള ഈ ഫലം പ്രൊഫഷണൽ വൈദ്യപരിശോധനയ്ക്ക് പകരമല്ല. തുടർച്ചയായതോ ഗുരുതരമായതോ ആശങ്കയുണ്ടാക്കുന്നതോ ആയ ലക്ഷണങ്ങൾക്ക് യോഗ്യനായ ആരോഗ്യവിദഗ്ധന്റെ വിലയിരുത്തൽ ആവശ്യമാണ്. ലക്ഷണങ്ങളുടെ കാരണം കണ്ടെത്താനോ ഏതെങ്കിലും ചികിത്സ അനുയോജ്യമാണോ എന്ന് തീരുമാനിക്കാനോ ഈ സ്കോറിന് കഴിയില്ല.',

    qLabel: (i, n) => `ചോദ്യം ${i} / ${n}`,
    progress: 'വിലയിരുത്തലിന്റെ പുരോഗതി',
    prev: 'മുമ്പത്തേത്',
    next: 'തുടരുക',
    errAnswer: 'തുടരാൻ ഒരു ഉത്തരം തിരഞ്ഞെടുക്കുക.',
    questions: {
      q1: { title: 'വയറുവീർക്കൽ', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് വയറുവീർക്കലോ വയർ നിറഞ്ഞിരിക്കുന്നതുപോലുള്ള തോന്നലോ അനുഭവപ്പെട്ടത്?' },
      q2: { title: 'ഗ്യാസ്, വയറിലെ അസ്വസ്ഥത', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് അമിതമായ ഗ്യാസ്, ഇടയ്ക്കിടെ ഏമ്പക്കം വരുക, അല്ലെങ്കിൽ വയറിലെ അസ്വസ്ഥത എന്നിവ അനുഭവപ്പെട്ടത്?' },
      q3: { title: 'അസിഡിറ്റി, ആസിഡ് റിഫ്ലക്സ്', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് നെഞ്ചെരിച്ചിൽ, ആസിഡ് മുകളിലേക്ക് വരുന്നത്, അല്ലെങ്കിൽ നെഞ്ചിലോ വയറിന്റെ മുകൾഭാഗത്തോ എരിച്ചിൽ അനുഭവപ്പെട്ടത്?' },
      q4: { title: 'വയറുവേദന', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് വയറുവേദനയോ വയറ്റിൽ പിടുത്തം പോലുള്ള വേദനയോ അനുഭവപ്പെട്ടത്?' },
      q5: { title: 'മലവിസർജനത്തിലെ ക്രമക്കേടുകൾ', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് മലബന്ധം, കട്ടിയുള്ള മലം, അയഞ്ഞ മലം, അല്ലെങ്കിൽ പതിവുപോലെ മലവിസർജനം നടത്താൻ ബുദ്ധിമുട്ട് എന്നിവ അനുഭവപ്പെട്ടത്?',
            help: 'ഇവയിൽ ഏതെങ്കിലും പ്രശ്നം ഉണ്ടായ ദിവസങ്ങളുടെ എണ്ണം അടിസ്ഥാനമാക്കി ഉത്തരം തിരഞ്ഞെടുക്കുക.' },
      q6: { title: 'മലവിസർജനം പൂർണമായില്ലെന്ന തോന്നൽ', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് മലവിസർജനത്തിന് ശേഷവും മലം പൂർണമായി പോയില്ലെന്ന തോന്നൽ ഉണ്ടായത്?' },
      q7: { title: 'ഭക്ഷണവുമായി ബന്ധപ്പെട്ട ലക്ഷണങ്ങൾ', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ എത്ര ദിവസമാണ് ഭക്ഷണം കഴിച്ചതിന് ശേഷമോ പ്രത്യേക ഭക്ഷണങ്ങൾ കഴിക്കുമ്പോഴോ ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ അനുഭവപ്പെട്ടത്?' },
      q8: { title: 'ദൈനംദിന ജീവിതത്തെ ബാധിക്കുന്നത്', text: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ നിങ്ങളുടെ ജോലി, ദൈനംദിന പ്രവർത്തനങ്ങൾ, ഉറക്കം, അല്ലെങ്കിൽ പൊതുവായ സുഖാവസ്ഥ എന്നിവയെ എത്ര തവണ ബാധിച്ചു?' }
    },
    options: {
      days: [
        { label: 'ഒരിക്കലുമില്ല', detail: '0 ദിവസം' }, { label: 'അപൂർവമായി', detail: '1–2 ദിവസം' },
        { label: 'ചിലപ്പോൾ', detail: '3–6 ദിവസം' }, { label: 'പതിവായി', detail: '7–14 ദിവസം' }
      ],
      freq: [
        { label: 'ഒരിക്കലുമില്ല', detail: '' }, { label: 'അപൂർവമായി', detail: '' },
        { label: 'ചിലപ്പോൾ', detail: '' }, { label: 'പതിവായി', detail: '' }
      ]
    },

    finalCheck: 'അവസാന സുരക്ഷാ പരിശോധന',
    finalCheckEyebrow: 'അവസാന സുരക്ഷാ പരിശോധന · സ്കോറിൽ ഉൾപ്പെടില്ല',
    warnH: 'നിങ്ങളുടെ ഫലം കാണിക്കുന്നതിന് മുമ്പ്',
    warnQ: 'താഴെപ്പറയുന്ന ലക്ഷണങ്ങളിൽ ഏതെങ്കിലും അനുഭവപ്പെട്ടിട്ടുണ്ടോ?',
    warnHelp: 'ബാധകമായവയെല്ലാം തിരഞ്ഞെടുക്കുക. ഇവ നിങ്ങളുടെ മൊത്തം സ്കോറിൽ ഉൾപ്പെടുത്തില്ല.',
    warnings: {
      blood: 'മലത്തിലോ ഛർദിയിലോ രക്തം കാണുക',
      blackStool: 'കറുത്ത, ടാർ പോലെയുള്ള മലം',
      weightLoss: 'വ്യക്തമായ കാരണമില്ലാതെ ശരീരഭാരം കുറയുക',
      vomiting: 'തുടർച്ചയായ ഛർദി',
      swallowing: 'വിഴുങ്ങാൻ ബുദ്ധിമുട്ട് അല്ലെങ്കിൽ വിഴുങ്ങുമ്പോൾ വേദന',
      severePain: 'കഠിനമായതോ തുടർച്ചയായി നിലനിൽക്കുന്നതോ ആയ വയറുവേദന',
      swelling: 'ഗണ്യമായതോ തുടർച്ചയായി നിലനിൽക്കുന്നതോ ആയ വയറുവീക്കം',
      jaundice: 'കണ്ണുകളിലോ ചർമ്മത്തിലോ മഞ്ഞനിറം',
      chest: 'നെഞ്ചുവേദന അല്ലെങ്കിൽ ശ്വസിക്കാൻ ബുദ്ധിമുട്ട്',
      none: 'മുകളിൽ പറഞ്ഞവയൊന്നുമില്ല'
    },
    showResult: 'എന്റെ ഫലം കാണുക',
    errWarn: 'ബാധകമായവ തിരഞ്ഞെടുക്കുക, അല്ലെങ്കിൽ “മുകളിൽ പറഞ്ഞവയൊന്നുമില്ല” തിരഞ്ഞെടുക്കുക.',
    urgentNowLead: 'ഗുരുതരമായ മുന്നറിയിപ്പ് ലക്ഷണങ്ങൾ ഇപ്പോൾ അനുഭവപ്പെടുന്നുണ്ടെങ്കിൽ ഓൺലൈൻ വിലയിരുത്തലിനോ ക്ലിനിക്കിന്റെ മറുപടിക്കോ കാത്തിരിക്കരുത്.',
    urgentNow: n => `ഉടൻ അടിയന്തര വൈദ്യസഹായം തേടുക. ഇന്ത്യയിലെ അടിയന്തര സഹായ നമ്പർ ${n} ആണ്.`,

    resultH: 'നിങ്ങളുടെ ഫലം',
    totalAria: (t, m) => `മൊത്തം സ്കോർ ${m}-ൽ ${t}`,
    scoreRange: (a, b) => `സ്കോർ ${a}–${b}`,
    bands: {
      low: { label: 'കുറഞ്ഞ ലക്ഷണഭാരം',
        interpretation: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ താരതമ്യേന കുറച്ച് ദഹനസംബന്ധമായ ലക്ഷണങ്ങളാണ് നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തിരിക്കുന്നത്.',
        nextStep: 'ആരോഗ്യകരമായ ദിനചര്യകൾ തുടരുക. പുതിയതായി ഉണ്ടാകുന്ന അല്ലെങ്കിൽ തുടരുന്ന ലക്ഷണങ്ങൾ ശ്രദ്ധിക്കുക.' },
      mild: { label: 'നേരിയ ദഹനസംബന്ധമായ പ്രശ്നങ്ങൾ',
        interpretation: 'ഇടയ്ക്കിടെയോ പ്രത്യേക ഭക്ഷണങ്ങൾ കഴിച്ചതിന് ശേഷമോ ചില ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ അനുഭവപ്പെടുന്നതായി നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തിരിക്കുന്നു.',
        nextStep: 'ഭക്ഷണവും ലക്ഷണങ്ങളും രേഖപ്പെടുത്തുക. പ്രശ്നങ്ങൾ തുടരുകയോ കൂടുകയോ ചെയ്താൽ വൈദ്യോപദേശം തേടുക.' },
      moderate: { label: 'മിതമായ തോതിലുള്ള ലക്ഷണങ്ങൾ',
        interpretation: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ കൂടുതൽ ശ്രദ്ധേയമായ തോതിൽ അനുഭവപ്പെടുന്നതായി സൂചിപ്പിക്കുന്നു.',
        nextStep: 'പ്രത്യേകിച്ച് ലക്ഷണങ്ങൾ ദൈനംദിന ജീവിതത്തെ ബാധിക്കുന്നുണ്ടെങ്കിൽ ആരോഗ്യവിദഗ്ധന്റെ വിലയിരുത്തൽ പരിഗണിക്കുക.' },
      high: { label: 'ഉയർന്ന ലക്ഷണഭാരം',
        interpretation: 'ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ പതിവായി അനുഭവപ്പെടുന്നതായോ അവ ജീവിതത്തെ ഗണ്യമായി ബാധിക്കുന്നതായോ നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തിരിക്കുന്നു.',
        nextStep: 'ലക്ഷണങ്ങളുടെ സാധ്യതയുള്ള കാരണങ്ങൾ മനസ്സിലാക്കാനും അനുയോജ്യമായ ചികിത്സ തീരുമാനിക്കാനും വൈദ്യപരിശോധന ക്രമീകരിക്കുക.' }
    },
    bandNote: 'ഈ സ്കോർ പരിധികൾ ബോധവൽക്കരണത്തിനായി നിർദേശിച്ചിട്ടുള്ള വിഭാഗങ്ങളാണ്; ക്ലിനിക്കൽ പരിശോധനകളിലൂടെ സാധൂകരിച്ചവയല്ല. കുറഞ്ഞ സ്കോർ രോഗമില്ലെന്ന് ഉറപ്പാക്കുന്നില്ല. ഉയർന്ന സ്കോർ ഗുരുതരമായ രോഗമുണ്ടെന്ന് സ്വതേ അർത്ഥമാക്കുന്നുമില്ല.',
    profileH: 'നിങ്ങളുടെ ലക്ഷണങ്ങളുടെ വിശദാംശങ്ങൾ',
    subscores: {
      bloatingGas: 'വയറുവീക്കവും ഗ്യാസും', acidity: 'അസിഡിറ്റിയും ആസിഡ് റിഫ്ലക്സും', pain: 'വയറുവേദന',
      bowel: 'മലവിസർജനത്തിന്റെ ക്രമം', food: 'ഭക്ഷണവുമായി ബന്ധപ്പെട്ട ലക്ഷണങ്ങൾ', impact: 'ദൈനംദിന ജീവിതത്തെ ബാധിക്കുന്ന വിധം'
    },
    outOf: (s, m) => `${m}-ൽ ${s}`,
    rawNote: 'ഓരോ വിഭാഗത്തിന്റെയും സ്കോറുകൾ വ്യത്യസ്ത പരമാവധി മൂല്യങ്ങളുള്ളവയാണ് (വയറുവീക്കവും ഗ്യാസും, മലവിസർജനത്തിന്റെ ക്രമം എന്നിവ 6-ൽ; മറ്റുള്ളവ 3-ൽ). അതിനാൽ സ്കോറുകൾ തമ്മിലുള്ള താരതമ്യം മാത്രം അടിസ്ഥാനമാക്കി ഏത് ആരോഗ്യപ്രശ്നമാണ് കൂടുതൽ ഗൗരവമുള്ളതെന്ന് തീരുമാനിക്കാനാവില്ല.',
    topH: 'ഏറ്റവും ഉയർന്ന സ്കോർ ലഭിച്ച വിഭാഗങ്ങൾ',
    tieNote: n => `${n} വിഭാഗങ്ങൾക്ക് ഒരേ ഉയർന്ന സ്കോറാണ്.`,
    noElevated: 'ഈ ഉത്തരങ്ങളിൽ നിന്ന് ഉയർന്ന ലക്ഷണ വിഭാഗമൊന്നും കണ്ടെത്തിയില്ല.',
    reportedH: 'നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തത്',
    expNone: 'കഴിഞ്ഞ 14 ദിവസങ്ങളിൽ ഈ 8 ലക്ഷണങ്ങളിൽ ഒന്നും നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തിട്ടില്ല.',
    expPart: (title, label, detail) => `${title} — ${label}${detail ? ` (${detail})` : ''}`,
    expLine: (area, s, m, parts) => `${area}: ${m}-ൽ ${s}. നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തത്: ${parts}.`,
    expImpact: freq => `ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ ദൈനംദിന ജീവിതത്തെ ${freq} ബാധിച്ചതായും നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തു.`,
    warnResH: 'മുന്നറിയിപ്പ് ലക്ഷണ പരിശോധന',
    noWarnings: 'ഈ വിലയിരുത്തലിൽ മുകളിൽ നൽകിയ മുന്നറിയിപ്പ് ലക്ഷണങ്ങളൊന്നും റിപ്പോർട്ട് ചെയ്തിട്ടില്ല.',
    noWarningsTail: 'എന്തെങ്കിലും മുന്നറിയിപ്പ് ലക്ഷണങ്ങൾ ഉണ്ടാകുകയോ ലക്ഷണങ്ങൾ കഠിനമാകുകയോ ചെയ്താൽ ഉടൻ വൈദ്യസഹായം തേടുക.',
    nextH: 'അടുത്തതായി എന്തുചെയ്യണം?',
    followSafety: 'ആദ്യം, ഈ പേജിന്റെ മുകളിലുള്ള സുരക്ഷാ നിർദേശം പാലിക്കുക.',

    youReported: 'നിങ്ങൾ തിരഞ്ഞെടുത്തത്:',
    urgentH: 'അടിയന്തര വൈദ്യസഹായം തേടുക',
    urgentLead: 'ഇവയിൽ ചില ലക്ഷണങ്ങൾക്ക് അടിയന്തര വൈദ്യസഹായം ആവശ്യമാണ്.',
    urgentBody: 'ഇവ ഇപ്പോൾ ഉണ്ടെങ്കിലോ ലക്ഷണങ്ങൾ കഠിനമാകുകയോ കൂടിവരികയോ ചെയ്യുന്നുണ്ടെങ്കിലോ, ഉടൻ അടുത്തുള്ള അത്യാഹിത വിഭാഗത്തിൽ പോകുക അല്ലെങ്കിൽ അടിയന്തര സഹായ നമ്പറിൽ വിളിക്കുക. ഓൺലൈൻ ഫോമിനോ ഈ ഫലത്തിനോ ക്ലിനിക്കിന്റെ മറുപടിക്കോ കാത്തിരിക്കരുത്.',
    urgentOthers: 'നിങ്ങൾ തിരഞ്ഞെടുത്ത മറ്റ് ലക്ഷണങ്ങളും എത്രയും വേഗം ഒരു ഡോക്ടർ പരിശോധിക്കേണ്ടതാണ്.',
    urgentFoot: 'ഒരു മുന്നറിയിപ്പ് ലക്ഷണം ഗുരുതരമാണോ നിരുപദ്രവമാണോ എന്ന് പറയാൻ ഈ ഉപകരണത്തിന് കഴിയില്ല. താഴെയുള്ള നിങ്ങളുടെ സ്കോർ ഈ നിർദേശം മാറ്റുന്നില്ല.',
    promptH: 'എത്രയും വേഗം ഡോക്ടറെ കാണാൻ ക്രമീകരിക്കുക',
    promptLead: 'നിങ്ങളുടെ സ്കോർ എത്രയായാലും, ഈ ലക്ഷണങ്ങൾ സമയബന്ധിതമായി ഒരു ഡോക്ടർ പരിശോധിക്കേണ്ടതാണ്.',
    promptBody: 'ഇവ പെട്ടെന്ന് ഉണ്ടാകുകയോ കഠിനമാകുകയോ കൂടിവരികയോ ചെയ്യുന്നുണ്ടെങ്കിൽ അടിയന്തര വൈദ്യസഹായം തേടുക.',
    promptFoot: 'ഒരു മുന്നറിയിപ്പ് ലക്ഷണം ഗുരുതരമാണോ നിരുപദ്രവമാണോ എന്ന് പറയാൻ ഈ ഉപകരണത്തിന് കഴിയില്ല.',
    call: n => `${n}-ൽ വിളിക്കുക`,
    emergencyLabel: 'ദേശീയ അടിയന്തര സഹായ നമ്പർ (ഇന്ത്യ)',

    waEyebrow: 'നിങ്ങളുടെ സ്കോർ എത്ര?',
    waH: 'ഡോക്ടറുമായി ബന്ധപ്പെട്ട് നിങ്ങളുടെ സ്കോർ മനസ്സിലാക്കൂ',
    waBody: 'ഒറ്റ ടാപ്പിൽ നിങ്ങളുടെ ഫലം WhatsApp വഴി ഡോക്ടർക്ക് അയച്ച്, ഇതിനെക്കുറിച്ച് എന്തുചെയ്യാനാകുമെന്ന് ചോദിക്കൂ.',
    waBtn: 'എന്റെ സ്കോർ WhatsApp-ൽ അയയ്ക്കുക',
    waNote: 'നിങ്ങളുടെ സ്കോർ ടൈപ്പ് ചെയ്ത നിലയിൽ WhatsApp തുറക്കും. അയയ്ക്കുന്നതിന് മുമ്പ് സന്ദേശം വായിക്കാനും മാറ്റാനും കഴിയും. മറുപടി ഉടൻ ലഭിക്കണമെന്നില്ല.',
    waUrgent: n => `അടിയന്തര മുന്നറിയിപ്പ് ലക്ഷണങ്ങൾ ഉണ്ടെങ്കിൽ ആദ്യം ${n}-ൽ വിളിക്കുക. WhatsApp മറുപടിക്ക് കാത്തിരിക്കരുത്.`,
    msg: {
      hello: 'നമസ്കാരം ഡോക്ടർ,',
      done: 'ഞാൻ ENZO Gut Health Score™ പൂർത്തിയാക്കി.',
      score: (t, m, band) => `*എന്റെ സ്കോർ: ${t}/${m} – ${band}*`,
      top: 'ഏറ്റവും ഉയർന്ന വിഭാഗങ്ങൾ',
      topNone: 'ഏറ്റവും ഉയർന്ന വിഭാഗങ്ങൾ: ഒന്നുമില്ല',
      areas: 'വിഭാഗങ്ങളുടെ സ്കോർ',
      warn: 'തിരഞ്ഞെടുത്ത മുന്നറിയിപ്പ് ലക്ഷണങ്ങൾ',
      warnNone: 'മുന്നറിയിപ്പ് ലക്ഷണങ്ങൾ: ഒന്നുമില്ല',
      ask: 'ഇതിനെക്കുറിച്ച് എന്തെങ്കിലും ചെയ്യാൻ കഴിയുമോ? ദയവായി കൂടുതൽ പറഞ്ഞുതരാമോ?',
      book: 'എനിക്ക് ഒരു കൺസൾട്ടേഷൻ ബുക്ക് ചെയ്യണം.'
    },

    ctaH: 'നിങ്ങളുടെ ദഹനസംബന്ധമായ ലക്ഷണങ്ങൾ കൂടുതൽ മനസ്സിലാക്കാൻ ആഗ്രഹിക്കുന്നുണ്ടോ?',
    ctaBody: 'വ്യക്തിഗതമായ വൈദ്യവിലയിരുത്തലിലൂടെ നിങ്ങളുടെ ലക്ഷണങ്ങൾ, ആരോഗ്യചരിത്രം, കൂടുതൽ പരിശോധനകൾ ആവശ്യമുണ്ടോ, അല്ലെങ്കിൽ സ്പെഷ്യലിസ്റ്റിന്റെ വിലയിരുത്തൽ വേണ്ടതുണ്ടോ എന്നിവ പരിശോധിക്കാനാകും.',
    ctaBtn: 'കൺസൾട്ടേഷൻ ബുക്ക് ചെയ്യുക',
    ctaFallback: 'കൺസൾട്ടേഷൻ ബുക്ക് ചെയ്യാൻ ENZO Homoeo Medical Centre-മായി നേരിട്ട് ബന്ധപ്പെടുക.',

    privacyH: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ',
    privacy1: 'നിങ്ങളുടെ ഫലം സേവ് ചെയ്തിട്ടില്ല. ബ്രൗസർ ടാബ് അടയ്ക്കുമ്പോഴോ വീണ്ടും ആരംഭിക്കുമ്പോഴോ ഉത്തരങ്ങൾ മായ്ക്കപ്പെടും. നിങ്ങൾ WhatsApp ബട്ടൺ ഉപയോഗിച്ച് അയച്ചാൽ മാത്രമേ ഫലം ക്ലിനിക്കിന് ലഭിക്കൂ.',
    privacy2: 'ഫലം പ്രിന്റ് ചെയ്ത് കൺസൾട്ടേഷൻ സമയത്ത് കൊണ്ടുവരാവുന്നതാണ്.',
    print: 'ഫലം പ്രിന്റ് ചെയ്യുക',
    restart: 'വീണ്ടും ആരംഭിക്കുക',
    printed: (v, d) => `ENZO Gut Health Score™ v${v} · പ്രിന്റ് ചെയ്തത് ${d}`,

    footerNote: 'ബോധവൽക്കരണത്തിനുള്ള ലക്ഷണ വിലയിരുത്തൽ. ഇതിലൂടെ രോഗം സ്ഥിരീകരിക്കാനോ ഇല്ലെന്ന് ഉറപ്പാക്കാനോ കഴിയില്ല. അടിയന്തര സാഹചര്യത്തിൽ അടിയന്തര സഹായ നമ്പറിൽ വിളിക്കുക.',
    footerWa: 'WhatsApp-ൽ ബന്ധപ്പെടുക',
    footerBook: 'കൺസൾട്ടേഷൻ ബുക്ക് ചെയ്യുക',
    footerPrivacy: 'സ്വകാര്യതാ നയം'
  }
};
