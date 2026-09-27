import * as yup from 'yup'

export const contactSchema = yup.object({
    // 1. Basic Information
    firstName: yup.string().min(2).required('First Name is required'),
    lastName: yup.string().min(2).required('Last Name is required'),
    title: yup.string().required('Title is required'),
    email: yup.string().email().required('Email is required'),
    // 10 to 12 digits; kept as text so that the leading 0 of local numbers (0901234567) is not lost
    phoneNumber: yup.string().matches(/^\d{10,12}$/, { message: 'Phone number is invalid', excludeEmptyString: true }).required('Phonenumber is Required'),
    mobileNumber: yup.string().matches(/^\d{10,12}$/, { message: 'Phone number is invalid', excludeEmptyString: true }).notRequired(),
    physicalAddress: yup.string().required('Physical address is required'),
    mailingAddress: yup.string(),
    preferredContactMethod: yup.string().required('Preferred contact method is required'),
    // 2.Lead Source Information
    leadSource: yup.string(),
    referralSource: yup.string(),
    campaignSource: yup.string(),
    // 3. Status and Classifications
    leadStatus: yup.string(),
    leadRating: yup.number(),
    leadConversionProbability: yup.string(),
    // 5. History:
    emailHistory: yup.string(),
    phoneCallHistory: yup.string(),
    meetingHistory: yup.string(),
    notesandComments: yup.string(),
    // 6. Tags or Categories
    tagsOrLabelsForcategorizingcontacts: yup.string(),
    // 7. Important Dates:
    birthday: yup.date(),
    anniversary: yup.date(),
    keyMilestones: yup.string(),
    // 8. Additional Personal Information
    dob: yup.string(),
    gender: yup.string(),
    occupation: yup.string(),
    interestsOrHobbies: yup.string(),
    // 9. Preferred  Communication Preferences:
    communicationFrequency: yup.string(),
    preferences: yup.string(),
    // 10. Social Media Profiles:
    linkedInProfile: yup.string(),
    facebookProfile: yup.string(),
    twitterHandle: yup.string(),
    otherProfiles: yup.string(),
    // 11. Lead Assignment and Team Collaboration:
    agentOrTeamMember: yup.string(),
    internalNotesOrComments: yup.string(),
    createBy: yup.string(),
    // 12. Custom Fields:
})