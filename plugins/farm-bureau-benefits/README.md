# Louisiana Farm Bureau Benefits Discovery Plugin

An interactive system that helps prospective Louisiana Farm Bureau members discover which benefits offer them the most personal value. Through a guided conversational intake, it builds a profile of the user's situation and generates a tailored benefit recommendation report.

## Features

- Conversational intake that adapts to four member profiles: farmers/ranchers, rural homeowners, small agri-businesses, and general community members
- Personalized benefit recommendations tied to the user's parish, operation, family, and stated concerns
- Deep-knowledge follow-up Q&A on any Farm Bureau benefit category
- Contact information for your local Louisiana Farm Bureau Insurance Agent

## Components

| Component | Type | Description |
|-----------|------|-------------|
| `/farm-bureau` | Command | Guided intake interview that generates a personalized benefits report |
| `benefits-advisor` | Agent | Expert Q&A on all LFBF benefits, insurance products, financial services, discounts, and programs |

## Usage

### Start a Benefits Consultation

Run the command with no arguments to begin the full intake:

```
/farm-bureau
```

Or provide optional context to skip ahead:

```
/farm-bureau rice farmer in Iberia Parish
/farm-bureau rural homeowner with cattle
/farm-bureau small agribusiness Shreveport
```

The command will ask a few conversational questions about your situation, then generate a personalized benefits profile with your most relevant Farm Bureau benefits highlighted.

### Ask Specific Questions

The `benefits-advisor` agent can answer detailed questions about any Farm Bureau program:

- "How does crop insurance work for sugarcane farmers?"
- "Is Farm Bureau Motor Club worth it compared to AAA?"
- "Do I have to be a farmer to join Louisiana Farm Bureau?"
- "What scholarships does Farm Bureau offer for college students?"
- "How does farm vehicle coverage differ from regular auto insurance?"

## Benefit Categories Covered

**Insurance**
- Farm/ranch property (structures, equipment, stored crops, livestock)
- Farm vehicle coverage (trucks, tractors, ag equipment)
- Personal auto
- Homeowners / rural property
- Crop and weather insurance (USDA RMA programs + supplemental)
- Life insurance (term, whole, universal)
- Health insurance for self-employed members
- Commercial / business insurance

**Financial Services**
- Agricultural lending and farm loans
- Retirement and investment products
- Estate planning and farm succession resources

**Member Discounts**
- National discount network (hotels, retailers, restaurants, travel)
- Prescription drug savings card (available immediately upon membership)
- Farm Bureau Motor Club roadside assistance
- Tire discounts
- Farm supply and equipment discounts
- Cell phone plan discounts

**Advocacy**
- Louisiana legislative representation (Baton Rouge)
- National advocacy through AFBF (Washington D.C.)
- Parish-level member representation

**Community & Education**
- Scholarship programs for high school and college students
- Young Farmers & Ranchers Committee (members under 35)
- LFBF Women's Leadership Committee
- Parish events, networking, and educational programs
- Louisiana Farm Bureau News (monthly member publication)
- Collegiate chapters at Louisiana universities

## About Louisiana Farm Bureau

Louisiana Farm Bureau Federation (LFBF) is Louisiana's largest farm organization, representing over 100,000 member families across all 64 parishes. Membership is open to all Louisiana residents — you don't have to be a farmer. LFBF is affiliated with the American Farm Bureau Federation (AFBF), providing both state-level advocacy in Baton Rouge and national representation in Washington D.C.

Members join through their local parish Farm Bureau office. Find yours at [lfbf.org](https://www.lfbf.org).

## Contact

**Garrett Gardner**
Louisiana Farm Bureau Insurance Agent

- Office: (225) 766-6565
- Cell: (225) 329-7192
- Email: ggardner@sfbcic.com
