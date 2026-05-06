const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer=require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

// ✅ Define schema in Gemini's native format (no zod-to-json-schema needed)
const interviewReportSchema = {
    type: "OBJECT",
    properties: {
        matchScore: {
            type: "NUMBER",
            description: "A score between 0 and 100 indicating how well the candidate matches the job"
        },
        title: {
            type: "STRING",
            description: "The title of the job for which the interview report is generated"
        },
        technicalQuestions: {
            type: "ARRAY",
            description: "Technical questions that can be asked in the interview",
            items: {
                type: "OBJECT",
                properties: {
                    question: {
                        type: "STRING",
                        description: "The technical question to be asked"
                    },
                    intention: {
                        type: "STRING",
                        description: "The intention of the interviewer behind asking this question"
                    },
                    answer: {
                        type: "STRING",
                        description: "How to answer this question, what points to cover"
                    }
                },
                required: ["question", "intention", "answer"]
            }
        },
        behavioralQuestions: {
            type: "ARRAY",
            description: "Behavioral questions that can be asked in the interview",
            items: {
                type: "OBJECT",
                properties: {
                    question: {
                        type: "STRING",
                        description: "The behavioral question to be asked"
                    },
                    intention: {
                        type: "STRING",
                        description: "The intention of the interviewer behind asking this question"
                    },
                    answer: {
                        type: "STRING",
                        description: "How to answer this question, what points to cover"
                    }
                },
                required: ["question", "intention", "answer"]
            }
        },
        skillGaps: {
            type: "ARRAY",
            description: "List of skill gaps in the candidate's profile",
            items: {
                type: "OBJECT",
                properties: {
                    skill: {
                        type: "STRING",
                        description: "The skill which the candidate is lacking"
                    },
                    severity: {
                        type: "STRING",
                        format: "enum",
                        enum: ["low", "medium", "high"],
                        description: "How critical this skill gap is"
                    }
                },
                required: ["skill", "severity"]
            }
        },
        preparationPlan: {
            type: "ARRAY",
            description: "A day-wise preparation plan for the candidate",
            items: {
                type: "OBJECT",
                properties: {
                    day: {
                        type: "NUMBER",
                        description: "The day number starting from 1"
                    },
                    focus: {
                        type: "STRING",
                        description: "The main focus area for this day"
                    },
                    tasks: {
                        type: "ARRAY",
                        description: "List of tasks to complete on this day",
                        items: {
                            type: "STRING"
                        }
                    }
                },
                required: ["day", "focus", "tasks"]
            }
        }
    },
    required: ["matchScore", "title", "technicalQuestions", "behavioralQuestions", "skillGaps", "preparationPlan"]
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate a detailed interview preparation report for a candidate based on the following information:
        Resume: ${resume}
        Self Description: ${selfDescription}
        Job Description: ${jobDescription}
    `

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: interviewReportSchema   // ✅ Native Gemini schema
        }
    })

    const parsed = JSON.parse(response.text)
    console.log(JSON.stringify(parsed, null, 2))
    return parsed
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}


async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })


    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}



module.exports = {generateInterviewReport, generateResumePdf}