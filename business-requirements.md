Absolutely. I’d frame this as a **product/engineering PRD for a Skylight Calendar-like product**, rather than simply documenting the existing hardware. I pulled in the current Skylight feature set as a baseline—shared calendars, chores, lists, meal planning, Magic Import/Sidekick, rewards, device linking, etc.—and structured the PRD so it could actually be handed to a product + engineering team. ([Skylight][1])

# Product Requirements Document — Skylight Calendar

**Product:** Skylight Calendar
**Document Version:** 1.0
**Status:** Draft
**Target Users:** Families / households
**Primary Platform:** Touchscreen household display + mobile/web companion
**Business Model:** Hardware + optional subscription
**Product Category:** Family operating system / smart household calendar

---

## 1. Executive Summary

### 1.1 Product Vision

**Skylight Calendar is the operating system for the modern family.**

It provides a single, highly visible place where a household can see:

* Where everyone needs to be
* What everyone needs to do
* What is coming next
* What needs to be purchased
* What the family is eating
* What chores need to be completed
* What important events are approaching

The product combines a **shared physical touchscreen** with mobile access so that the family has a persistent "source of truth" for household coordination.

The goal is not to build another calendar.

The goal is to **eliminate the mental overhead of running a household.**

---

# 2. Problem Statement

Modern families coordinate information across too many disconnected systems:

* Google Calendar
* Apple Calendar
* Outlook
* School emails
* Paper flyers
* Sports schedules
* Text messages
* To-do lists
* Grocery lists
* Chore charts
* Meal plans
* Family group chats

This creates several problems:

### Information fragmentation

Important information exists in multiple places and people don't know which source is authoritative.

### Poor visibility

A parent may know about an appointment that another family member doesn't know about.

### Constant reminders

Parents become the "human notification system":

> "Did you remember soccer?"

> "You have a dentist appointment."

> "Did you take out the trash?"

> "What's for dinner?"

### Children's lack of ownership

Children frequently depend on parents to tell them what they need to do instead of being able to independently see their responsibilities.

### Excessive coordination overhead

Parents spend significant time translating information from emails, school notices, calendars and messages into actionable tasks.

---

# 3. Product Opportunity

The product should move the family from:

**"Mom/Dad knows everything"**

to:

**"The household knows everything."**

This distinction is critical.

The calendar should become a **shared household interface**, not simply another calendar application.

Current Skylight positioning already emphasizes this concept: a centralized hub for events, tasks and lists, with shared visibility across family members. ([Skylight Calendar][2])

---

# 4. Goals

## Primary Goals

### G1 — Create a single source of truth

All important household events should be visible in one place.

### G2 — Reduce parental coordination

Parents should spend less time reminding, scheduling and communicating household logistics.

### G3 — Increase family participation

Children should be able to independently understand their schedules and responsibilities.

### G4 — Make information glanceable

A family member should understand the day's important information in **5–10 seconds**.

### G5 — Make household administration effortless

Adding information should require minimal manual data entry.

### G6 — Extend beyond the calendar

The product should eventually become a **household operating system**, not merely a calendar display.

---

# 5. Non-Goals

The initial product will **not** attempt to become:

* A general-purpose social network
* A replacement for Gmail/Outlook
* A full project-management platform
* A general-purpose AI assistant
* A smart-home controller
* A financial management application
* A medical-record system
* A school management platform

Integrations should remain focused on **household coordination**.

---

# 6. Target Personas

## Persona 1 — Household Administrator

Usually a parent who manages most family logistics.

### Needs

* See everyone's schedule
* Add events quickly
* Resolve conflicts
* Manage chores
* Manage meals
* Keep track of school activities
* Reduce repetitive reminders

### Pain point

> "I feel like I'm the project manager for my entire family."

---

## Persona 2 — Working Parent

Needs to quickly understand what is happening today and tomorrow.

### Pain point

> "I don't have time to dig through five different calendars."

---

## Persona 3 — Child

Needs a simple visual representation of:

* School
* Activities
* Chores
* Responsibilities
* Rewards
* Upcoming events

### Pain point

> "I don't know what I'm supposed to do."

---

## Persona 4 — Extended Family

Grandparents, babysitters, co-parents or other trusted individuals.

Needs controlled access to household information.

---

# 7. Core Product Experience

The product consists of four major surfaces.

### 1. Household Display

The physical touchscreen mounted or placed in the home.

### 2. Mobile Application

Parents can manage the household remotely.

### 3. Web Application

Useful for more complex management and configuration.

### 4. Intelligent Household Assistant

AI functionality that converts unstructured information into structured household data.

---

# 8. Information Architecture

The main navigation should consist of:

```text
HOME
│
├── Calendar
│
├── Tasks
│
├── Chores
│
├── Meals
│
├── Lists
│
├── Family
│
└── Assistant
```

---

# 9. Calendar

## 9.1 Calendar Views

The display must support:

* Day
* Week
* Month
* Schedule
* Agenda

The current product already provides multiple calendar views and color-coded family members. ([Skylight][3])

---

## 9.2 Family Profiles

Each family member has:

* Name
* Avatar/photo
* Color
* Age/category
* Calendar connections
* Permissions

Example:

| Person   | Color  | Role  |
| -------- | ------ | ----- |
| Parent 1 | Blue   | Admin |
| Parent 2 | Green  | Admin |
| Child 1  | Purple | Child |
| Child 2  | Orange | Child |

---

# 10. Calendar Integrations

The system should synchronize with:

* Google Calendar
* Apple Calendar
* Microsoft Outlook
* Yahoo Calendar
* Cozi

These are among the calendar providers currently supported by Skylight. ([Skylight][4])

### Requirements

* Two-way synchronization where supported
* Read-only synchronization where required
* OAuth authentication
* Automatic refresh
* Conflict detection
* Duplicate event prevention
* Calendar-level visibility controls

---

# 11. Event Model

Each event should support:

```text
Event
├── Title
├── Start Time
├── End Time
├── Location
├── Description
├── Person/People
├── Calendar
├── Color
├── Recurrence
├── Reminder
├── Travel Time
├── Attachments
└── Tasks
```

Example:

**Soccer Practice**

```text
Tuesday
5:30 PM – 7:00 PM

📍 Memorial Park
👤 Imran
🚗 18 min drive

Bring:
☑ Soccer shoes
☑ Water
☑ Jersey
```

---

# 12. Tasks & Chores

The household should have a unified task system.

### Task types

* One-time tasks
* Recurring tasks
* Chores
* Routines
* Household tasks
* Personal tasks

Example:

**Morning Routine**

```text
☐ Make bed
☐ Brush teeth
☐ Get dressed
☐ Pack backpack
☐ Eat breakfast
```

---

# 13. Chore System

Parents can configure:

* Chore
* Person
* Frequency
* Due time
* Points/stars
* Reward

Example:

| Chore          | Person | Frequency | Reward |
| -------------- | ------ | --------- | -----: |
| Take trash out | Child  | Daily     |    2 ⭐ |
| Clean room     | Child  | Weekly    |   10 ⭐ |
| Feed dog       | Child  | Daily     |    3 ⭐ |

The existing Skylight model uses interactive chore charts and star-based rewards to encourage children to complete tasks. ([Skylight][1])

---

# 14. Rewards

Children earn points/stars for completing responsibilities.

### Reward configuration

Parents define:

```text
Reward
├── Name
├── Cost
├── Description
├── Available
└── Approval Required
```

Example:

```text
50 ⭐ → 30 minutes extra gaming
100 ⭐ → Pick Friday dinner
200 ⭐ → $10 allowance
500 ⭐ → Special outing
```

The system should never allow a child to modify their own reward configuration.

---

# 15. Meal Planning

Meal planning should be integrated directly into the calendar.

### Meal categories

* Breakfast
* Lunch
* Dinner
* Snack

Users should be able to:

* Create recipes
* Save recipes
* Drag meals onto calendar days
* Repeat meals
* Mark favorites
* Generate grocery lists

Current Skylight Plus supports meal planning, recipes and AI-assisted meal generation. ([Skylight][5])

---

# 16. Grocery Lists

A grocery list can be generated automatically from the meal plan.

Example:

```text
GROCERY LIST

Produce
☐ Bananas
☐ Lettuce
☐ Tomatoes

Dairy
☐ Milk
☐ Cheese

Meat
☐ Chicken breast

Pantry
☐ Rice
☐ Pasta
```

Optional integrations can send the list to grocery services.

Skylight currently supports transferring grocery items to Instacart in the U.S. ([Skylight][3])

---

# 17. Custom Lists

Users should be able to create arbitrary lists:

* Birthday gifts
* Packing list
* Home improvement
* School supplies
* Things to buy
* Vacation checklist

Lists should support:

* Checkbox
* Quantity
* Category
* Assignee
* Due date
* Notes

---

# 18. AI Assistant — "Sidekick"

This is where I would significantly expand the concept beyond the traditional Skylight product.

The assistant should be able to transform **unstructured information into household actions.**

### Inputs

* Email
* PDF
* Photograph
* Screenshot
* Flyer
* Text
* Voice
* Calendar event
* Web content

### Output

Structured:

```text
Event
Task
Reminder
Meal
Recipe
Shopping item
List item
```

Current Skylight Sidekick/Magic Import already uses email, PDFs and photos to create calendar events and supports AI-assisted recipes/lists. ([Skylight][1])

---

# 19. Example: School Email

Parent forwards:

> "Reminder: Fall Festival is Friday October 16th from 5–8 PM. Students should bring a decorated pumpkin. Volunteers should arrive at 4 PM."

Assistant responds:

```text
I found 3 household actions:

📅 Fall Festival
Friday, Oct 16
5:00–8:00 PM

🎃 Bring decorated pumpkin
Assigned to Zara

⏰ Volunteer arrival
4:00 PM
Assigned to Sohel

Add all three?
```

User taps:

**Add All**

Done.

This should be one of the product's signature experiences.

---

# 20. AI Household Intelligence

Eventually the assistant should proactively reason across household information.

Example:

> "You have soccer at 5:30 PM tomorrow, but Zara's dentist appointment ends at 5:15 PM and it's 25 minutes away."

Then:

**Potential conflict detected**

> Someone may need to pick up Imran from soccer.

Possible actions:

* Assign another parent
* Ask grandparent
* Reschedule appointment
* Find alternative transportation

This moves the product from **calendar software → household intelligence.**

---

# 21. Notifications

Notifications should be intelligent rather than noisy.

### Examples

**Morning**

> Good morning!
> You have 7 events today.

**Before departure**

> 🚗 Leave in 15 minutes for soccer.

**Task reminder**

> Zara has 2 chores remaining today.

**Conflict**

> ⚠️ Two events overlap at 5:00 PM.

Notifications should support:

* Push
* Email
* SMS
* Device notification

---

# 22. Household Dashboard

The default display should answer five questions immediately:

### 1. What's happening today?

### 2. Who needs to be where?

### 3. What needs to get done?

### 4. What's for dinner?

### 5. What's coming up?

Example:

```text
┌──────────────────────────────────────────────┐
│ FRIDAY, AUGUST 28                            │
│                                              │
│ TODAY                                        │
│                                              │
│ 8:00   School                                │
│ 3:30   Soccer              IMRAN             │
│ 5:00   Dentist             ZARA              │
│ 6:30   Dinner              🍝                │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ TO DO                                        │
│ □ Take trash out       IMRAN                 │
│ □ Grocery shopping     SOHEL                 │
│                                              │
│ DINNER                                       │
│ Chicken Pasta 🍝                             │
│                                              │
│ TOMORROW                                     │
│ 10:00   Birthday Party                       │
└──────────────────────────────────────────────┘
```

---

# 23. Physical Hardware Requirements

The household display should provide:

### Display

* HD or higher
* Touchscreen
* Wide viewing angles
* Automatic brightness
* Portrait/landscape support

Current Skylight products range from 10" to 27" displays, with the 27" Max designed for wall mounting. ([Skylight][3])

### Connectivity

* Wi-Fi
* Bluetooth
* Optional USB-C

### Sensors

Potential future support:

* Ambient light
* Presence
* Camera
* Microphone

Camera/microphone should be **disabled by default** and require explicit consent.

---

# 24. Device Linking

Multiple household displays should operate as one synchronized system.

Example:

```text
Kitchen Calendar
       │
       ├──────────────┐
       │              │
Living Room       Upstairs
 Calendar          Calendar
       │              │
       └──────┬───────┘
              │
       Household Cloud
```

A change made on one device should propagate to all devices.

Current Skylight supports linking multiple calendars across rooms or households. ([Skylight Calendar][6])

---

# 25. Mobile Application

The mobile app should allow parents to:

* View calendar
* Create events
* Edit events
* Manage chores
* Approve rewards
* Manage grocery lists
* Manage meals
* Upload documents
* Send information to Sidekick
* Manage family members
* Configure devices

The physical display should remain the **primary shared interface**.

The mobile app is the **remote control**.

---

# 26. Permissions

### Household Admin

Full control.

### Parent

Events, chores, meals, lists and children.

### Child

View assigned information and complete tasks.

### Guest

Limited calendar visibility.

### Read-only

View household schedule without modification rights.

---

# 27. Privacy & Security

Because the product contains family schedules and potentially children's information, privacy is a first-class requirement.

### Requirements

* Encryption in transit
* Encryption at rest
* OAuth for calendar providers
* Role-based access
* Device authentication
* Remote device logout
* Parental controls
* Audit logging
* Data deletion
* Account export

### AI privacy

AI processing should clearly indicate:

* What data is being processed
* Why it is being processed
* Whether data is retained
* Which external AI service processes it

---

# 28. Subscription Model

A strong model is:

### Hardware

One-time purchase.

### Core

Free forever:

* Calendar
* Family profiles
* Calendar synchronization
* Tasks
* Lists
* Chores
* Mobile app
* Device linking

### Premium

Subscription:

* AI Sidekick
* Magic Import
* Advanced meal planning
* Recipe intelligence
* Rewards
* Photo/video screensaver
* Advanced household intelligence

This mirrors the existing Skylight model, which currently separates standard functionality from a $79/year Plus tier. ([Skylight][7])

---

# 29. MVP

The MVP should **not** attempt to implement everything above.

### Phase 1

#### Core Calendar

* Family profiles
* Google Calendar
* Outlook
* Apple Calendar
* Day/week/month views
* Color coding
* Event creation/editing
* Mobile application

#### Household

* Tasks
* Chores
* Recurring chores
* Custom lists

#### Hardware

* Touchscreen UI
* Wi-Fi
* Device pairing
* Cloud synchronization
* Sleep mode
* Parental lock

---

# 30. Phase 2

Add:

* Meal planning
* Grocery lists
* Recipes
* Rewards
* Device linking
* Photo screensaver
* Weather
* Countdown events
* Additional calendar integrations

---

# 31. Phase 3 — AI

Introduce:

### Sidekick

* Email → event
* PDF → event
* Photo → event
* Flyer → event
* Screenshot → event
* Recipe extraction
* Meal generation
* Grocery generation
* Smart lists

---

# 32. Phase 4 — Household Agent

This is the strategic differentiator.

The system moves from:

**"Tell me what's on the calendar."**

to:

**"Help me run my household."**

Capabilities:

### Conflict resolution

> "We have two appointments at 4 PM."

### Planning

> "Plan our Saturday."

### Optimization

> "What's the best time to grocery shop based on our schedule?"

### Reminders

> "Remind me to buy a birthday gift two weeks before John's birthday."

### Proactive assistance

> "School starts Monday. You have not purchased school supplies."

### Family coordination

> "Who can pick up Zara at 4?"

---

# 33. Key Metrics

## North Star Metric

### **Household Coordination Success Rate**

Percentage of household activities successfully coordinated through the platform without requiring manual parent intervention.

---

## Supporting Metrics

### Engagement

* Daily active households
* Weekly active households
* Device interactions/day
* Mobile interactions/day

### Calendar

* Events created
* Events imported
* Calendar sync success rate
* Event conflicts resolved

### Chores

* Tasks completed
* Completion rate
* On-time completion rate

### AI

* Documents processed
* Events successfully extracted
* User acceptance rate
* Correction rate

### Business

* Hardware conversion
* Subscription conversion
* Subscription retention
* Household lifetime value

---

# 34. UX Success Criteria

The product should satisfy these principles:

### Glanceable

Users should understand what's happening without navigating menus.

### Family-first

The interface should work for a child as well as an adult.

### Low friction

Adding information should take seconds.

### Calm

The display should not feel like another notification-heavy device.

### Action-oriented

Information should lead to action.

### Proactive

The system should increasingly anticipate household needs.

---

# 35. Example End-to-End Experience

### Sunday evening

Parent receives six school emails.

Instead of manually entering them:

**Forward → Sidekick**

The system extracts:

```text
Monday
📚 School picture day

Tuesday
🏃 Track practice

Wednesday
🎨 Art supplies due

Thursday
🏫 Parent conference

Friday
🎉 School festival
```

The parent reviews:

**"Add all"**

The household display updates.

Then Sidekick notices:

> "Wednesday requires art supplies. Would you like me to add them to the grocery list?"

Parent:

**Yes**

Later:

> "You have chicken, rice and broccoli in your pantry. Want me to suggest three dinners?"

Parent selects:

**Chicken stir fry**

The ingredients are added to the grocery list.

At the end of the week, the children see their chores on the display, complete them, and earn stars toward their rewards.

That's the product loop.

---

# 36. Product Differentiation

The competitive advantage should **not** be:

> "We have a bigger digital calendar."

It should be:

> **"We understand how a household operates."**

The product's moat comes from the intersection of:

```text
Calendar
   +
Family
   +
Tasks
   +
Meals
   +
Shopping
   +
AI
   +
Physical Presence
   +
Household Memory
```

The physical display is important because it creates a **shared family interface** that everyone sees—not another app buried on someone's phone.

---

# 37. Long-Term Vision

Ultimately, Skylight should evolve into a **Household Operating System**.

```text
                 HOUSEHOLD AI
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    Calendar        Tasks          Family
       │              │              │
       ├──────────────┼──────────────┤
       │              │              │
     Meals         Shopping        Home
       │              │              │
       └──────────────┼──────────────┘
                      │
               HOUSEHOLD MEMORY
                      │
              ┌───────┴───────┐
              │               │
         Mobile App      Home Display
```

The killer feature isn't the calendar.

It's the **shared memory and intelligence layer underneath the calendar**.

That is where I'd take the product if the goal is to build something meaningfully differentiated from today's Skylight rather than simply reproduce its feature set. ([Skylight][1])

If you're using this PRD as the starting point for **actually building the product**, the next artifact I'd create is a **technical architecture + domain model + MVP screen-by-screen specification**, because that would turn this from a product concept into something an engineering team could start implementing.

[1]: https://myskylight.com/calendar?utm_source=chatgpt.com "Skylight Calendar | Smart Family Calendar"
[2]: https://shop.myskylight.com/sandbox?utm_source=chatgpt.com "Skylight Calendar | The Digital Family Calendar That Keeps Everyone In Sync"
[3]: https://myskylight.com/products/skylight-calendar-max?utm_source=chatgpt.com "Skylight Calendar Max | The Smart Calendar for Busy Families"
[4]: https://myskylight.com/products/the-skylight-calendar-pro-149/?utm_source=chatgpt.com "Skylight Calendar | The Digital Calendar for Busy Families"
[5]: https://myskylight.com/lp/meal-planning/?utm_source=chatgpt.com "Skylight | Meal Planning"
[6]: https://shop.myskylight.com/?utm_source=chatgpt.com "Skylight Calendar | The Digital Family Calendar That Keeps Everyone In Sync"
[7]: https://myskylight.com/products/calendar-skylight-plus/?utm_source=chatgpt.com "Skylight Calendar Plus | Digital Calendar Upgraded Subscription"

