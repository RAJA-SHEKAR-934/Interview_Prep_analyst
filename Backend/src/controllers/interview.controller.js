const pdfParse = require("pdf-parse/node")
const {generateInterviewReport, generateResumePdf} = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")


/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterviewReportController(req, res) {
    try {
        // Guard: multer didn't receive the file (field name mismatch or missing)
        let resumeText = ""
        if (req.file) {
            const parsed = await pdfParse(req.file.buffer)
            resumeText = parsed.text
        }

        const { selfDescription, jobDescription } = req.body

        if(!selfDescription && !resumeText) {
            return res.status(400).json({ message: "Either a resume or self description is required" })
        }

        if (!jobDescription) {
            return res.status(400).json({ message: "jobDescription is required" })
        }


        const interviewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interviewReportByAi
        })

        res.status(201).json({
            message: "Interview report generated successfully",
            interviewReport
        })

    } catch (error) {
        console.error("generateInterviewReportController error:", error)
        res.status(500).json({ message: "Failed to generate interview report", error: error.message })
    }
}

async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params
        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found" })
        }

        res.status(200).json({
            message: "Interview report fetched successfully",
            interviewReport
        })
    } catch (error) {
        console.error("getInterviewReportByIdController error:", error)
        res.status(500).json({ message: "Failed to fetch interview report", error: error.message })
    }
}

/**
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

        res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        })
    } catch (error) {
        console.error("getAllInterviewReportsController error:", error)
        res.status(500).json({ message: "Failed to fetch interview reports", error: error.message })
    }
}

async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }