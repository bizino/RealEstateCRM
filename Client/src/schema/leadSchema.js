import * as yup from 'yup'

export const leadSchema = yup.object({
    // Lead Information:
    leadName: yup.string().required("Lead Name Is required"),
    leadEmail: yup.string().email().required("Lead Email Is required"),
    // 10 to 12 digits (a leading 0 is allowed); string().min/max would check the text length
    leadPhoneNumber: yup.string().matches(/^\d{10,12}$/, { message: 'Phone number is invalid', excludeEmptyString: true }).required("Lead Phone Number Is required"),
    leadAddress: yup.string().required("Lead Address Is required"),
    // Lead Source and Details:
    leadSource: yup.string(),
    leadStatus: yup.string(),
    leadSourceDetails: yup.string(),
    leadCampaign: yup.string(),
    leadSourceChannel: yup.string(),
    leadSourceMedium: yup.string(),
    leadSourceCampaign: yup.string(),
    leadSourceReferral: yup.string(),
    // Lead Assignment and Ownership:
    leadAssignedAgent: yup.string(),
    leadOwner: yup.string(),
    leadCommunicationPreferences: yup.string(),
    // Lead Dates and Follow-up:
    leadCreationDate: yup.date().required("Lead Creation Date Is required"),
    leadConversionDate: yup.date().required("Lead Conversion Date Is required"),
    leadFollowUpDate: yup.date().required("lead Follow Up Date  Is required"),
    leadFollowUpStatus: yup.string(),
    // Lead Scoring and Nurturing:
    leadScore: yup.number().required("Lead Score Is required"),
    leadNurturingWorkflow: yup.string(),
    leadEngagementLevel: yup.string(),
    leadConversionRate: yup.number().required("lead Conversion Rate Is required"),
    leadNurturingStage: yup.string(),
    leadNextAction: yup.string(),
})
