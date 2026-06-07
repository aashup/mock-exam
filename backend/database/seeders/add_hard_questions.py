import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read existing questions
with open('questions_data_hard_level.json', 'r', encoding='utf-8') as f:
    existing_questions = json.load(f)

existing_texts = {q['question'] for q in existing_questions}
print(f"Existing unique questions: {len(existing_texts)}\n")

# New hard-level questions to add
new_questions = [
    {"question": "भारत के स्वतंत्रता संग्राम में 'सशस्त्र क्रांति' के दौरान किन आंदोलनों को 'आतंकवादी' माना गया और इसके ऐतिहासिक कारण क्या थे?", "options": [{"text": "केवल बाहरी दबाव", "is_correct": false}, {"text": "ब्रिटिश शासन के विरुद्ध प्रतिरोध और राजनीतिक परिणति", "is_correct": true}, {"text": "केवल धार्मिक उद्देश्य", "is_correct": false}, {"text": "यह एक काल्पनिक अवधारणा है", "is_correct": false}], "explanation": "भारतीय क्रांतिकारियों को 'आतंकवादी' कहा गया किंतु वे ब्रिटिश साम्राज्यवाद के विरुद्ध सशस्त्र संघर्ष कर रहे थे।"},
    {"question": "भारत के औपनिवेशिक काल में 'ज़मींदारी प्रथा' और 'रैयतवारी व्यवस्था' में मौलिक अंतर क्या था?", "options": [{"text": "कोई अंतर नहीं", "is_correct": false}, {"text": "ज़मींदारी में मध्यस्थ होते थे, रैयतवारी में सीधा किसान", "is_correct": true}, {"text": "दोनों समान थीं", "is_correct": false}, {"text": "केवल भाषागत अंतर", "is_correct": false}], "explanation": "ज़मींदारी प्रथा में ज़मींदार मध्यस्थ थे, जबकि रैयतवारी में किसान सीधे राजस्व देते थे।"},
    {"question": "भारत के विभाजन में 'कम्युनल अवार्ड' का क्या महत्व था?", "options": [{"text": "कोई महत्व नहीं", "is_correct": false}, {"text": "अल्पसंख्यकों को पृथक प्रतिनिधित्व दिया, जिससे ध्रुवीकरण बढ़ा", "is_correct": true}, {"text": "यह केवल एक संवैधानिक प्रावधान था", "is_correct": false}, {"text": "इसका विभाजन से कोई संबंध नहीं", "is_correct": false}], "explanation": "कम्युनल अवार्ड ने अल्पसंख्यकों को अलग निर्वाचन क्षेत्र दिए, जिससे साम्प्रदायिक ध्रुवीकरण में वृद्धि हुई।"},
    {"question": "भारत में 'जाति सर्वेक्षण' के निषेध के पीछे क्या राजनीतिक और सामाजिक कारण हैं?", "options": [{"text": "तकनीकी कारण", "is_correct": false}, {"text": "शक्तिशाली जातियों का प्रभाव और सांख्यिकीय गोपनीयता", "is_correct": true}, {"text": "आर्थिक कारण", "is_correct": false}, {"text": "कोई कारण नहीं", "is_correct": false}], "explanation": "जाति सर्वेक्षण न होने से जाति-आधारित भेदभाव की वास्तविक स्थिति छिपी रहती है।"},
    {"question": "भारत के 'नियोजित विकास' में किन क्षेत्रों को प्राथमिकता दी गई और इसके क्या परिणाम हुए?", "options": [{"text": "कृषि को प्राथमिकता", "is_correct": false}, {"text": "भारी उद्योग और बुनियादी ढांचे को, जिससे असमान विकास हुआ", "is_correct": true}, {"text": "सेवा क्षेत्र को", "is_correct": false}, {"text": "सभी को समान प्राथमिकता", "is_correct": false}], "explanation": "नेहरूवादी विकास मॉडल ने भारी उद्योग और बुनियादी ढांचे को प्राथमिकता दी, जिससे क्षेत्रीय असमानता बढ़ी।"},
]

# Count duplicates
duplicate_count = 0
for q in new_questions:
    if q['question'] in existing_texts:
        duplicate_count += 1
        print(f"Skipping: {q['question'][:60]}...")

print(f"\nDuplicates found: {duplicate_count}")
print(f"New questions to add: {len(new_questions) - duplicate_count}\n")

# Add only non-duplicate questions
for q in new_questions:
    if q['question'] not in existing_texts:
        existing_questions.append(q)
        existing_texts.add(q['question'])

# Write updated file
with open('questions_data_hard_level.json', 'w', encoding='utf-8') as f:
    json.dump(existing_questions, f, ensure_ascii=False, indent=2)

print(f"✓ File updated!")
print(f"✓ Total questions: {len(existing_questions)}")
print(f"✓ Need to add: {500 - len(existing_questions)} more questions")
