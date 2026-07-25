# IT Helpdesk System - User Guide

## Overview

This is a comprehensive IT Helpdesk Information System that uses **Forward Chaining Algorithm** for automatic problem identification and solution recommendation.

## Key Features

### ✅ Functional Requirements Implemented

**FR-01: User Authentication**
- Secure login/logout for both Users and IT Support
- Role-based access control

**FR-02: Problem Reporting**
- Conversational, natural language interface (like Google/Gemini)
- Users can describe problems in plain English
- Example: "My laptop cannot print documents"

**FR-03: Report Data Storage**
- All reports saved to database for archiving and analysis

**FR-04: Automatic Problem Identification (Forward Chaining)**
- AI-powered inference engine
- Matches reported symptoms against knowledge base rules
- Iteratively applies rules to infer problems

**FR-05: Display of Recommended Solutions**
- Step-by-step solutions based on inference results
- Clear, actionable guidance

**FR-06: Ticket Creation for Unresolved Issues**
- Automatic ticket creation when no solution found
- Forwarded to IT Support for manual handling

**FR-07: IT Support Ticket Management**
- View all active tickets
- Provide feedback and responses
- Update ticket status (Open → In Progress → Resolved → Closed)
- Assign tickets to team members

**FR-08: Knowledge Base Learning and Update**
- IT Support can add/update rules and solutions
- System learns from new cases

**FR-09: Report History and Status Tracking**
- Users can view all past reports
- See resolution status and feedback

**FR-10: Knowledge Base Management**
- Full CRUD operations for rules and solutions
- Add, modify, or delete outdated entries

## How It Works

### Forward Chaining Inference Engine

1. **User Input**: User describes problem in natural language
2. **Symptom Extraction**: System extracts keywords/symptoms from text
3. **Rule Matching**: Forward chaining algorithm matches symptoms against rules
4. **Inference**: Rules fire iteratively to infer problems
5. **Solution Lookup**: System finds solutions for inferred problems
6. **Result Display**: Shows solutions OR creates support ticket

### Example Flow

**User Input:**
```
"My laptop cannot print documents to the office printer"
```

**System Processing:**
1. Extracts symptom: `cannot_print`
2. Matches rule: IF `cannot_print` THEN `printer_connection_issue`
3. Fires rule: Adds `printer_connection_issue` to working memory
4. Matches rule: IF `printer_connection_issue` THEN `check_printer_connection`
5. Finds solution for `check_printer_connection`
6. Displays step-by-step printer troubleshooting guide

**If No Solution:**
- System automatically offers to create support ticket
- User clicks "Create Support Ticket"
- Ticket sent to IT Support team
- User can track status in "My Tickets"

## Getting Started

### Demo Accounts

**User Account:**
- Email: `user@demo.com`
- Password: `password123`
- Can: Report problems, view history, track tickets

**IT Support Account:**
- Email: `support@demo.com`
- Password: `password123`
- Can: Manage tickets, update knowledge base, add rules/solutions

### For End Users

1. **Sign in** with your credentials
2. Click **"Ask Support"** button
3. Type your problem in natural language
   - Example: "I cannot access my email"
   - Example: "My computer is running very slow"
   - Example: "Printer shows offline"
4. Click **"Get Help"** or press Ctrl+Enter
5. **Review the solution** provided by the AI
   - Follow step-by-step instructions
   - OR create a ticket if no solution found
6. Check **"My Tickets"** to track support requests
7. View **"History"** to see past reports

### For IT Support

1. **Sign in** with IT Support credentials
2. **Support Tickets Tab:**
   - View all active tickets
   - Update ticket status
   - Assign tickets to team members
   - Add responses/comments
   - Close resolved tickets
3. **Knowledge Base Tab:**
   - **Rules Section:**
     - Add new inference rules
     - Format: IF [conditions] THEN [conclusion]
     - Example: IF `slow_computer` AND `high_cpu_usage` THEN `performance_issue`
   - **Solutions Section:**
     - Add solutions for identified problems
     - Include step-by-step instructions
     - Link to rule conclusions

## Knowledge Base Structure

### Rules (Forward Chaining Logic)

**Format:**
```
IF [condition1, condition2, ...] THEN conclusion
```

**Example:**
```
IF [cannot_print] THEN printer_connection_issue
IF [printer_connection_issue] THEN check_printer_connection
```

**Chaining:**
- Rules can chain together
- Conclusion of one rule becomes condition for another
- Enables complex problem identification

### Solutions

**Format:**
- Problem identifier (matches rule conclusion)
- Solution title
- Step-by-step instructions
- Category

**Example:**
```
Problem: check_printer_connection
Title: Fix Printer Connection Issues
Steps:
  1. Check if printer is powered on
  2. Verify cables are connected
  3. Go to Settings > Printers
  4. Remove and re-add printer
  5. Test print
Category: Hardware
```

## Architecture

### Frontend
- React + TypeScript
- Tailwind CSS for styling
- Conversational UI (Google/Gemini-style)
- Real-time updates

### Backend
- Supabase Edge Functions (Hono web server)
- Supabase Authentication (role-based)
- Key-Value Store for data persistence
- Forward Chaining inference engine in server

### Data Flow
```
User → Frontend → Server → Inference Engine → Knowledge Base
                      ↓
                  Solutions OR Ticket
```

## Technical Details

### Forward Chaining Algorithm Implementation

```typescript
1. Initialize working memory with reported symptoms
2. While (new facts can be inferred):
   a. For each rule in knowledge base:
      - Check if all conditions are in working memory
      - If yes AND conclusion not yet inferred:
        * Add conclusion to working memory
        * Mark rule as used
3. Find solutions for all inferred facts
4. Return solutions OR indicate no solution found
```

### Symptom Extraction (Natural Language → Keywords)

The system uses keyword mapping to extract symptoms:
- "email" → `cannot_access_email`
- "slow" → `slow_computer`
- "print" → `cannot_print`
- "vpn" → `cannot_connect_vpn`
- etc.

## Best Practices

### For Users
- Be specific in describing your problem
- Mention error messages if any
- Include what you've already tried
- Follow solutions step-by-step before creating ticket

### For IT Support
- Keep knowledge base updated
- Add rules for common problems
- Write clear, actionable solution steps
- Update rules based on resolved tickets
- Close tickets when resolved
- Document new solutions learned from tickets

## Adding New Knowledge

### Example: Adding "Slow Internet" Solution

**1. Add Rule (IT Support → Knowledge Base → Rules):**
```
Conditions: slow_internet, low_bandwidth
Conclusion: network_congestion
Confidence: 0.85
```

**2. Add Solution Rule:**
```
Conditions: network_congestion
Conclusion: optimize_network_usage
Confidence: 0.9
```

**3. Add Solution (IT Support → Knowledge Base → Solutions):**
```
Problem: optimize_network_usage
Title: Optimize Network Usage
Steps:
  - Close bandwidth-heavy applications
  - Disconnect unused devices from WiFi
  - Clear browser cache
  - Restart router
  - Contact IT if problem persists
Category: Network
```

Now when a user reports "my internet is slow", the system will:
1. Extract `slow_internet` symptom
2. Apply forward chaining rules
3. Infer `network_congestion` → `optimize_network_usage`
4. Display the solution!

## Troubleshooting

**Problem: "No solution found for my issue"**
- Solution: Create a support ticket - IT will help and potentially add new rules

**Problem: "Solution didn't work"**
- Solution: Create a ticket for manual assistance

**Problem: "Can't find my ticket"**
- Solution: Check "My Tickets" tab in user dashboard

**Problem: "Need to add a new type of problem"**
- Solution: IT Support can add new rules and solutions in Knowledge Base

## System Learning

The system learns over time as IT Support:
1. Reviews tickets without automatic solutions
2. Identifies patterns in user problems
3. Creates new rules in knowledge base
4. Adds corresponding solutions
5. Future users with similar problems get automatic solutions!

This creates a **continuous improvement cycle** where the system becomes smarter with each resolved ticket.

---

## Technical Support

If you encounter any issues with the system itself, please contact your system administrator.

**Note:** This system is for demonstration and prototyping purposes. For production use with real user data, additional security measures and compliance considerations would be required.
