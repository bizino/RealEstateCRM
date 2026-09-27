const mongoose = require('mongoose');


const Contact = new mongoose.Schema({
    // 1. Basic Information
    // Vietnamese full name ("Nguyễn Văn An"), firstName ("An") and lastName
    // ("Nguyễn Văn") are derived from it for sorting and older screens
    fullName: String,
    firstName: String,
    lastName: String,
    title: String,
    email: String,
    // Strings keep the leading 0 of local numbers (0901234567); values saved as
    // numbers by older versions are converted when read
    phoneNumber: String,
    mobileNumber: String,
    zalo: String,
    physicalAddress: String,
    mailingAddress: String,
    preferredContactMethod: String,
    // 2.Lead Source Information
    leadSource: String,
    referralSource: String,
    campaignSource: String,
    // 3. Status and Classifications
    leadStatus: String,
    leadRating: Number,
    leadConversionProbability: String,
    // 4. Needs: buyer | renter | investor | seller | landlord | other
    customerType: String,
    budgetFrom: Number,
    budgetTo: Number,
    interestedArea: String,
    interestedPropertyType: String,
    // Property of Interest
    interestProperty: [{
        type: mongoose.Schema.ObjectId,
        ref: 'property',
    }],
    // 5. History:
    notesandComments: String,
    // 6. Tags or Categories
    tagsOrLabelsForcategorizingcontacts: String,
    // 7. Important Dates:
    birthday: Date,
    anniversary: Date,
    keyMilestones: String,
    // 8. Additional Personal Information
    dob: String,
    gender: String,
    occupation: String,
    interestsOrHobbies: String,
    // 9. Preferred  Communication Preferences:
    communicationFrequency: String,
    preferences: String,
    // 10. Social Media Profiles:
    linkedInProfile: String,
    facebookProfile: String,
    twitterHandle: String,
    otherProfiles: String,
    // Citizen id (CCCD), only needed for deposit / sale contracts
    idNumber: String,
    // Consent of the customer to the processing of their personal data
    // (Luật Bảo vệ dữ liệu cá nhân 2025)
    dataConsent: Boolean,
    dataConsentDate: Date,
    // 11. Lead Assignment and Team Collaboration:
    agentOrTeamMember: String,
    internalNotesOrComments: String,
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedDate: {
        type: Date,
        default: Date.now
    },
    createdDate: {
        type: Date,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
})

module.exports = mongoose.model('Contact', Contact)


