import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, Packer } from 'docx';

export interface DocxQuizPayload {
  studentName: string;
  rollNumber: string;
  semester: string;
  section: string;
  className: string;
  subjectName: string;
  subjectCode: string;
  quizTitle: string;
  quizId: string;
  submissionId: string;
  submittedAt: Date;
  questions: Array<{
    questionNumber: number;
    questionText: string;
    questionType: string;
    marks: number;
    studentAnswer: string;
  }>;
}

export const generateQuizSubmissionDocx = async (data: DocxQuizPayload): Promise<Buffer> => {
  const formattedDate = new Date(data.submittedAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header / Title
          new Paragraph({
            text: 'ASSIGNMENT / QUIZ SUBMISSION RECEIPT',
            heading: HeadingLevel.TITLE,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Quiz: `, bold: true, size: 28 }),
              new TextRun({ text: data.quizTitle, size: 28, color: '1e3a8a' }),
            ],
            spacing: { after: 300 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Student Name:', bold: true })] })],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph(data.studentName)],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Roll Number:', bold: true })] })],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph(data.rollNumber)],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Class / Section:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph(`${data.className} (Semester: ${data.semester}, Section: ${data.section})`)],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Subject:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph(`${data.subjectName} (${data.subjectCode})`)],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Submission ID:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph(data.submissionId)],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Quiz ID:', bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph(data.quizId)],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Submitted At:', bold: true })] })],
                  }),
                  new TableCell({
                    columnSpan: 3,
                    children: [new Paragraph(formattedDate)],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { after: 300 } }),
          new Paragraph({
            text: 'RESPONSES & ANSWERS',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          }),

          // Questions & Answers Loop
          ...data.questions.flatMap((q) => [
            new Paragraph({
              children: [
                new TextRun({ text: `Question ${q.questionNumber} `, bold: true, color: '1e40af' }),
                new TextRun({ text: `(${q.questionType} - ${q.marks} Mark${q.marks > 1 ? 's' : ''}):`, bold: true }),
              ],
              spacing: { before: 150, after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: q.questionText, italics: true })],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Answer: ', bold: true }),
                new TextRun({ text: q.studentAnswer || '[No Answer Provided]' }),
              ],
              spacing: { after: 200 },
            }),
          ]),

          new Paragraph({ text: '', spacing: { after: 400 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated officially by Assignment & Quiz Portal on ${formattedDate}. Verified Submission ID: ${data.submissionId}.`,
                italics: true,
                size: 18,
                color: '6b7280',
              }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
};
