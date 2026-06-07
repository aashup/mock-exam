"""
UPPSC Questions PDF to JSON Converter
Extracts questions from official UPPSC PYQ papers and converts to JSON format
"""

import json
import pdfplumber
import re
from pathlib import Path

class UPPSCQuestionExtractor:
    """Extract UPPSC questions from PDF files"""

    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.questions = []

    def extract_questions(self) -> list:
        """Extract all questions from PDF"""

        with pdfplumber.open(self.pdf_path) as pdf:
            print(f"[+] Processing PDF: {self.pdf_path}")
            print(f"[+] Total pages: {len(pdf.pages)}\n")

            full_text = ""
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                full_text += text + "\n"
                print(f"  Extracted page {i+1}/{len(pdf.pages)}")

        # Parse questions from text
        self._parse_questions(full_text)
        return self.questions

    def _parse_questions(self, text: str):
        """
        Parse questions from extracted text
        Supports common UPPSC paper formats
        """

        # Pattern to identify questions
        # Typical format: "1. Question text here?"
        question_pattern = r'^\d+\.\s+(.+?)$'
        # Option pattern: "a) Option text" or "(a) Option text"
        option_pattern = r'^[a-d]\)\s+(.+?)$'

        lines = text.split('\n')
        current_question = None
        options = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if line is a question
            question_match = re.match(question_pattern, line, re.IGNORECASE)
            if question_match:
                # Save previous question if exists
                if current_question:
                    self._save_question(current_question, options)

                current_question = question_match.group(1)
                options = []
                continue

            # Check if line is an option
            option_match = re.match(option_pattern, line, re.IGNORECASE)
            if option_match and current_question:
                options.append(option_match.group(1))

        # Save last question
        if current_question:
            self._save_question(current_question, options)

    def _save_question(self, question: str, options: list):
        """Save a question with its options"""

        if len(options) != 4:
            print(f"  ⚠ Warning: Question has {len(options)} options (expected 4)")
            return

        question_obj = {
            "question": question,
            "options": [
                {"text": opt, "is_correct": False}
                for opt in options
            ],
            "explanation": ""  # User needs to add this
        }

        self.questions.append(question_obj)

    def save_to_json(self, output_path: str):
        """Save questions to JSON file"""

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.questions, f, ensure_ascii=False, indent=2)

        print(f"\n[+] Saved {len(self.questions)} questions to {output_path}")
        return output_path

    def get_summary(self):
        """Print extraction summary"""
        print("\n" + "="*60)
        print("EXTRACTION SUMMARY")
        print("="*60)
        print(f"Total questions extracted: {len(self.questions)}")
        print(f"\nSample questions:")
        for i, q in enumerate(self.questions[:3], 1):
            print(f"\n{i}. {q['question'][:70]}...")
            print(f"   Options: {len(q['options'])}")
        print("\n" + "="*60)


# ============== USAGE EXAMPLE ==============

if __name__ == "__main__":

    # STEP 1: Download PDF from UPPSC website
    print("UPPSC Questions PDF Extractor")
    print("="*60)
    print("\nSteps:")
    print("1. Download UPPSC papers from: https://uppsc.up.nic.in")
    print("2. Save PDF in same folder as this script")
    print("3. Run this script\n")

    # STEP 2: Specify your PDF file
    pdf_file = "uppsc_general_studies_2023.pdf"  # Change this to your PDF name

    # Check if file exists
    if not Path(pdf_file).exists():
        print(f"[!] File not found: {pdf_file}")
        print(f"[!] Please download PDF and save as: {pdf_file}")
        print("\nDownload from: https://uppsc.up.nic.in/OuterPages/PreQuesPapers.aspx")
        exit(1)

    # STEP 3: Extract questions
    try:
        extractor = UPPSCQuestionExtractor(pdf_file)
        questions = extractor.extract_questions()

        # STEP 4: Save to JSON
        output_file = pdf_file.replace('.pdf', '_extracted.json')
        extractor.save_to_json(output_file)

        # Print summary
        extractor.get_summary()

        print(f"\n[SUCCESS] Extraction complete!")
        print(f"[+] Output file: {output_file}")
        print(f"[!] NOTE: Please manually verify questions and add correct answers")

    except Exception as e:
        print(f"[ERROR] Extraction failed: {str(e)}")
        print("\nTroubleshooting:")
        print("- Check if PDF format is standard")
        print("- Try opening PDF in text editor to see structure")
        print("- PDF might be scanned image (needs OCR)")


# ============== MANUAL VERIFICATION TEMPLATE ==============

def manual_verify_and_fix(json_file: str):
    """
    Template to manually verify and fix extracted questions
    """

    with open(json_file, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    print(f"[+] Loaded {len(questions)} questions")
    print("\nNow you need to:")
    print("1. Mark correct options (set is_correct=True for correct option)")
    print("2. Add explanations")
    print("3. Fix any extraction errors")
    print("\nExample structure:")
    print(json.dumps({
        "question": "What is the capital of India?",
        "options": [
            {"text": "Delhi", "is_correct": True},
            {"text": "Mumbai", "is_correct": False},
            {"text": "Bangalore", "is_correct": False},
            {"text": "Kolkata", "is_correct": False}
        ],
        "explanation": "Delhi is the capital of India..."
    }, ensure_ascii=False, indent=2))


# ============== FOR SCANNED PDFs (OCR NEEDED) ==============

def extract_from_scanned_pdf(pdf_path: str):
    """
    For scanned PDFs - requires pytesseract and Tesseract-OCR installed

    Installation:
    1. pip install pytesseract
    2. pip install pdf2image
    3. Download Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
    """

    print("[!] For scanned PDFs, you need OCR:")
    print("\n1. Install Tesseract:")
    print("   Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki")
    print("   Linux: sudo apt-get install tesseract-ocr")
    print("   Mac: brew install tesseract")

    print("\n2. Install Python packages:")
    print("   pip install pytesseract pdf2image")

    print("\n3. Run OCR extraction:")
    print("   from pdf2image import convert_from_path")
    print("   import pytesseract")
    print("   images = convert_from_path('scanned.pdf')")
    print("   for img in images:")
    print("       text = pytesseract.image_to_string(img, lang='hin+eng')")
