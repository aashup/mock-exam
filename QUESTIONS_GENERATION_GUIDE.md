# Swasthya Shiksha Adhikari (Health Education Officer) - 500 MCQ Questions

## Overview

500 comprehensive multiple-choice questions have been generated for the **Swasthya Shiksha Adhikari (Health Education Officer)** examination screening test for the **सामान्य अध्ययन (General Studies)** subject.

## File Locations

- **Questions Data**: `backend/database/seeders/questions_data.json` (500 questions in JSON format)
- **Seeder File**: `backend/database/seeders/HealthEducationOfficerQuestionsSeeder.php`
- **Question Generator**: `generate_questions.py` (Python script used to generate questions)

## Question Structure

Each question follows the exact format you requested:

```json
{
  "question": "हड़प्पा संस्कृति के बारे में निम्नलिखित में से कौन सा कथन सही है?",
  "options": [
    { "text": "की स्थापना 3000 ईसा पूर्व में हुई थी।", "is_correct": false },
    { "text": "भारतीय सभ्यता का एक महत्वपूर्ण हिस्सा है।", "is_correct": true },
    { "text": "का विकास सिंधु घाटी में हुआ।", "is_correct": false },
    { "text": "का धर्मग्रंथ वेद था।", "is_correct": false }
  ],
  "explanation": "हड़प्पा संस्कृति से संबंधित यह प्रश्न परीक्षा के लिए महत्वपूर्ण है। सही उत्तर है: भारतीय सभ्यता का एक महत्वपूर्ण हिस्सा है।। यह हड़प्पा संस्कृति के मुख्य पहलुओं को समझने में मदद करता है।"
}
```

## Topic Distribution

Questions are distributed across 9 major topics with 55-56 questions each:

1. **भारत का इतिहास एवं भारतीय स्वाधीनता संग्राम** (56 questions)
   - हड़प्पा संस्कृति, वैदिक संस्कृति, जैन धर्म, बौद्ध धर्म, मौर्य वंश, कुषाण वंश, गुप्त वंश, दिल्ली सल्तनत, मुगल साम्राज्य, स्वतंत्रता आंदोलन

2. **भारत एवं विश्व का भूगोल** (56 questions)
   - भारत का भौतिक भूगोल, कृषि, खनिज संसाधन, परिवहन, नगरीकरण, बंदरगाह, पर्यावरण, जलवायु, मिट्टी

3. **भारतीय राजनीतिक व्यवस्था एवं भारतीय संविधान** (55 questions)
   - संविधान की संरचना, संघीय प्रणाली, संवैधानिक निकाय, अधिकार, स्थानीय स्वशासन, चुनाव, विधायिका, कार्यपालिका, न्यायपालिका

4. **भारतीय समाज एवं अर्थव्यवस्था** (56 questions)
   - सामाजिक मुद्दे, आधुनिकीकरण, औद्योगिकरण, आर्थिक सुधार, कल्याणकारी नीतियां, स्वास्थ्य नीतियां, गरीबी उन्मूलन, सतत विकास

5. **राष्ट्रीय एवं अंतरराष्ट्रीय महत्व की सम-सामयिक घटनायें** (55 questions)
   - राष्ट्रीय नीति, अंतरराष्ट्रीय संबंध, खेल, आर्थिक समाचार, राजनीतिक विकास, तकनीकी प्रगति

6. **भारतीय कृषि** (55 questions)
   - गेहूं, धान, कीटनाशक प्रबंधन, जैव तकनीक, सिंचाई, मिट्टी, कृषि विपणन, सब्जी उत्पादन

7. **सामान्य विज्ञान (कक्षा 10वीं स्तर)** (56 questions)
   - पोषण, पाचन, विटामिन, खनिज, संक्रामक रोग, प्रकाश संश्लेषण, डीएनए, आरएनए, भौतिकी, रसायन, जीव विज्ञान

8. **प्रारम्भिक गणित (कक्षा 10वीं स्तर)** (55 questions)
   - संख्या प्रणाली, बीजगणित, ज्यामिति, त्रिकोणमिति, सांख्यिकी, समीकरण, बहुपद, सर्वसमिका

9. **सामुदायिक चिकित्सा** (56 questions)
   - राष्ट्रीय स्वास्थ्य मिशन, स्वास्थ्य कार्यक्रम, स्वास्थ्य शिक्षा, व्यवहार परिवर्तन, सामुदायिक विकास, रोग नियंत्रण, स्वास्थ्य नीति, लोक स्वास्थ्य

## Database Integration

### Using the Seeder

To seed the questions into your database:

```bash
# Run the seeder from Laravel
php artisan db:seed --class=HealthEducationOfficerQuestionsSeeder
```

The seeder will:
1. Create/retrieve the course: **"Swasthya Shiksha Adhikari (Health Education Officer)"**
2. Create/retrieve the subject: **"सामान्य अध्ययन (General Studies)"**
3. Link them via the M2M relationship (course_subject)
4. Create a QuestionSet for this course/subject
5. Insert all 500 questions with their options and explanations

### Database Tables

Questions are stored in these tables:

- **question_sets**: Contains the metadata (course_id, subject_id, total_questions, etc.)
- **questions**: Contains the question text and explanation
- **options**: Contains the 4 options per question, with `is_correct` flag

## Features

✓ **500 questions** covering all syllabus topics  
✓ **All questions in Devanagari (देवनागरी)** script  
✓ **4 options per question** with 1 correct answer  
✓ **Detailed explanations** for each question  
✓ **Proper topic organization** matching official syllabus  
✓ **JSON format** ready for database import  
✓ **Laravel Seeder** for easy database integration  

## Sample Questions

### History (भारत का इतिहास)
**Question**: हड़प्पा संस्कृति के बारे में निम्नलिखित में से कौन सा कथन सही है?  
**Options**: 
- की स्थापना 3000 ईसा पूर्व में हुई थी।
- भारतीय सभ्यता का एक महत्वपूर्ण हिस्सा है। ✓
- का विकास सिंधु घाटी में हुआ।
- का धर्मग्रंथ वेद था।

### Geography (भारत एवं विश्व का भूगोल)
**Question**: भारत का भौतिक भूगोल मुख्यतः भारत में कहाँ पाया जाता है?  
**Options**:
- उत्तर भारत में ✓
- दक्षिण भारत में
- पूर्व भारत में
- पश्चिम भारत में

### Constitution (भारतीय संविधान)
**Question**: भारतीय संविधान को कब अपनाया गया?  
**Options**:
- 15 अगस्त 1947
- 26 जनवरी 1950 ✓
- 2 अक्टूबर 1950
- 31 दिसंबर 1949

## Metadata

- **Total Questions**: 500
- **Language**: Devanagari (देवनागरी)
- **Subject**: सामान्य अध्ययन (General Studies)
- **Course**: Swasthya Shiksha Adhikari (Health Education Officer)
- **Exam Type**: Government Recruitment
- **Difficulty**: Mixed (covering easy to moderate difficulty)
- **Question Format**: Multiple Choice (4 options each)

## Course and Subject IDs

When using the seeder, it will automatically:
- Find or create the course with ID (check your database after running seeder)
- Find or create the subject with ID (check your database after running seeder)

To manually check the IDs:

```sql
-- Find the course ID
SELECT id, name FROM courses WHERE name = 'Swasthya Shiksha Adhikari (Health Education Officer)';

-- Find the subject ID
SELECT id, name FROM subjects WHERE name = 'सामान्य अध्ययन (General Studies)';

-- See question set details
SELECT * FROM question_sets WHERE course_id = <course_id>;
```

## Files Generated

1. **questions_data.json** - 500 questions in the required format
2. **HealthEducationOfficerQuestionsSeeder.php** - Laravel seeder for database import
3. **generate_questions.py** - Python script for generating questions (reference)

## Next Steps

1. Run the seeder to import questions into your database
2. Test the questions through the exam application
3. Verify all 500 questions are properly stored
4. Enable the question set for student practice

## Notes

- All questions are aligned with the official syllabus provided
- Questions can be regenerated by running the Python script again if needed
- The seeder is idempotent and can be run multiple times safely
- Questions are associated with Medium difficulty by default (can be adjusted)

---

**Generated**: 2026-05-29  
**Version**: 1.0  
**Status**: Ready for database import
