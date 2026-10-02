const mongoose = require('mongoose');

const property = new mongoose.Schema({
    // Listing code (BDS00001), generated when the property is created
    code: String,
    // Short listing title ("Bán căn hộ 2PN Vinhomes Grand Park")
    title: String,
    // sale | rent
    transactionType: String,
    //1. basicPropertyInformation:
    // apartment | townhouse | alleyHouse | villa | shophouse | land | projectLand | ... (see the web client)
    propertyType: String,
    // Full address, composed from street / ward / province when they are sent
    propertyAddress: String,
    street: String,
    // Ward / commune (xã, phường, đặc khu) and province of the 2025 administrative map
    ward: String,
    province: String,
    // Address before the 2025 merger of provinces and communes (quận / huyện cũ)
    oldAddress: String,
    mapUrl: String,
    projectName: String,
    block: String,
    unitCode: String,
    floorNumber: String,
    // Asking price in VND (sale price, or monthly rent)
    price: Number,
    // Free text price of older versions
    listingPrice: String,
    // Areas and dimensions in m² / m
    area: Number,
    usableArea: Number,
    width: Number,
    length: Number,
    roadWidth: Number,
    floors: Number,
    // Free text area of older versions
    squareFootage: String,
    numberofBedrooms: Number,
    numberofBathrooms: Number,
    yearBuilt: Number,
    direction: String,
    balconyDirection: String,
    // pinkBook | saleContract | waitingBook | handwritten | other
    legalStatus: String,
    // full | basic | none
    furniture: String,
    propertyDescription: String,
    //2. Property Features and Amenities:
    lotSize: String,
    parkingAvailability: String,
    appliancesIncluded: String,
    heatingAndCoolingSystems: String,
    flooringType: String,
    exteriorFeatures: String,
    communityAmenities: String,
    //3. Media and Visuals:
    propertyPhotos: [],
    virtualToursOrVideos: [],
    floorPlans: [],
    propertyDocuments: [],
    //4. Listing and Marketing Details:
    // available | deposited | sold | rented | paused (active / pending / sold in older versions)
    listingStatus: String,
    // The status was set by a deal (deposit, sale...): cancelling the deal makes
    // the property available again. Set back to false when edited by hand.
    statusSetByDeal: Boolean,
    // consignment | exclusive | project | collected | partner
    sourceType: String,
    // End of the consignment / exclusive brokerage contract
    contractExpiry: Date,
    // Commission agreed with the owner, in % of the price
    commissionRate: Number,
    commissionNote: String,
    // Owner of the property: only shown to the employee who manages the listing and admins
    ownerName: String,
    ownerPhone: String,
    listingAgentOrTeam: String,
    listingDate: String,
    marketingDescription: String,
    multipleListingService: String,
    //5. Property History:
    previousOwners: Number,
    purchaseHistory: String,
    //6. Financial Information:
    propertyTaxes: String,
    homeownersAssociation: String,
    mortgageInformation: String,
    //7. Contacts Associated with Property:
    sellers: String,
    buyers: String,
    photo: String,
    propertyManagers: String,
    contractorsOrServiceProviders: String,
    //8. Property Notes and Comments:
    internalNotesOrComments: String,
    deleted: {
        type: Boolean,
        default: false,
    },
    updatedDate: {
        type: Date,
        default: Date.now
    },
    createdDate: {
        type: Date,
    },
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    //9. Custom Fields
})

module.exports = mongoose.model('property', property)
