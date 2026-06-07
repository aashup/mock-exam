<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;

/**
 * Seeds the "Swasthya Shiksha Adhikari (Health Education Officer)" course, its
 * "सामान्य अध्ययन" (General Studies) subject, and the full syllabus topics from
 * the official exam outline. Idempotent — safe to run repeatedly.
 */
class HealthEducationOfficerSeeder extends Seeder
{
    public function run(): void
    {
        $course = Course::firstOrCreate(
            ['name' => 'Swasthya Shiksha Adhikari (Health Education Officer)'],
            ['exam_type' => 'Government Recruitment']
        );

        $subject = Subject::firstOrCreate(['name' => 'सामान्य अध्ययन (General Studies)']);

        // Link subject <-> course (M2M) without dropping other links.
        $course->subjects()->syncWithoutDetaching([$subject->id]);

        // Replace topics so re-running reflects edits here, not duplicates.
        $subject->topics()->delete();

        foreach ($this->topics() as $i => $topic) {
            Topic::create([
                'subject_id' => $subject->id,
                'title' => $topic['title'],
                'description' => $topic['description'],
                'position' => $i + 1,
            ]);
        }
    }

    /**
     * @return array<int, array{title: string, description: string}>
     */
    private function topics(): array
    {
        return [
            [
                'title' => 'भारत का इतिहास एवं भारतीय स्वाधीनता संग्राम',
                'description' => 'हड़प्पा संस्कृति, वैदिक संस्कृति, जैन एवं बौद्ध धर्म, मौर्य वंश, कुषाण वंश, गुप्त वंश; दिल्ली सल्तनत, मुगल साम्राज्य और भारत का स्वतंत्रता आन्दोलन।',
            ],
            [
                'title' => 'भारत एवं विश्व का भूगोल',
                'description' => 'भारत का भूगोल – भारत का भौतिक एवं सांस्कृतिक परिचय, भारत में कृषि, खनिज, विविध संसाधन, परिवहन एवं नगरीकरण, भारत के बंदरगाह, पर्यावरण एवं प्रदूषण, आयात एवं निर्यात, उत्तर प्रदेश की सामान्य भौगोलिक जानकारी। विश्व का भूगोल – भौतिक भूगोल, सौरमण्डल, स्थलमण्डल, वायुमण्डल, जलमण्डल, जैवमण्डल, मानव एवं आर्थिक भूगोल, पर्यावरण एवं सतत विकास।',
            ],
            [
                'title' => 'भारतीय राजनीतिक व्यवस्था एवं भारतीय संविधान',
                'description' => 'भारतीय संविधान, संघीय प्रणाली, संवैधानिक एवं वैधानिक निकाय, भारत में स्थानीय स्वशासन, उत्तर प्रदेश की राजनीतिक व्यवस्था।',
            ],
            [
                'title' => 'भारतीय समाज एवं अर्थव्यवस्था',
                'description' => 'भारतीय समाज के मुद्दे एवं चुनौतियाँ; आधुनिकीकरण, औद्योगिकरण, नगरीकरण एवं भूमण्डलीकरण; आर्थिकी के उपागम; आजादी के पश्चात आर्थिक सुधार; विभिन्न वर्गों के लिए नीतियाँ एवं कल्याणकारी उपाय; स्वास्थ्य के आयाम, बीमारी एवं स्वच्छता के पहलू; राज्य एवं स्वास्थ्य देखभाल; मानव पारिस्थितिकी, मानवीय विकास एवं सतत विकास; पर्यावरण आंदोलन एवं चिंतायें।',
            ],
            [
                'title' => 'राष्ट्रीय एवं अंतरराष्ट्रीय महत्व की सम-सामयिक घटनायें',
                'description' => 'खेल-कूद के साथ राष्ट्रीय एवं अंतरराष्ट्रीय महत्व की समसामयिक घटनायें।',
            ],
            [
                'title' => 'भारतीय कृषि',
                'description' => 'भारत में प्रमुख फसलों की उत्पादन तकनीकी, एकीकृत नाशीजीव प्रबंधन (आई.पी.एम.), कृषि उत्पाद एवं उनके विपणन।',
            ],
            [
                'title' => 'सामान्य विज्ञान (कक्षा 10वीं स्तर तक)',
                'description' => 'पोषण, पाचन क्रिया, पोषक तत्वों की कमी (विटामिन एवं खनिज), जीवाणुजनित और विषाणुजनित रोग, प्रकाश संश्लेषण, औषधीय पौधे, डी.एन.ए., आर.एन.ए., इकाई, माप, काम, ऊर्जा, पृष्ठ तनाव, श्यानता, मनुष्य की आँख, दर्पण, लेन्स, विद्युत आवेश, प्रतिरोध, चुम्बकीय क्षेत्र, परमाणु के मूलभूत कण, समस्थानिक, समभारिक, तत्व, अणु, धातु, अधातु, अम्ल, क्षार, लवण, साबुन, डिटर्जेन्ट, प्राकृतिक एवं कृत्रिम मधुरक।',
            ],
            [
                'title' => 'प्रारम्भिक गणित (कक्षा 10वीं स्तर तक)',
                'description' => 'वास्तविक संख्या, अंकगणित के मूलभूत प्रमेय, बहुआयामी पद, दो चरों वाले रैखिक समीकरण युग्म, अंकगणितीय प्रगति, त्रिकोण, वृत्त से सम्बन्धित क्षेत्रफल, सतह क्षेत्र और आयतन।',
            ],
            [
                'title' => 'सामुदायिक चिकित्सा',
                'description' => 'राष्ट्रीय स्वास्थ्य मिशन, भारत में राष्ट्रीय स्वास्थ्य कार्यक्रम, स्वास्थ्य शिक्षा एवं व्यवहार परिवर्तन संचार (बी.सी.सी.), सामूहिक गतिशीलता एवं संसाधन गतिशीलता।',
            ],
        ];
    }
}
