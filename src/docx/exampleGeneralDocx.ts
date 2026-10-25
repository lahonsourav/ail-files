import type { GeneralDocx } from "./docxDocBuilder.js";

// Fixed marketing sample shown on /domain/docx_maker — same idea as
// lib/exampleGeneralPdf.ts for PDF Maker: a real, deterministic render of
// actual product output, not a mockup.
export const EXAMPLE_DOCX_PROMPT =
  "Write a formal letter to my landlord about a delayed repair, and make me a Word document.";

export const EXAMPLE_DOCX: GeneralDocx = {
  title: "Request for Repair Follow-Up",
  subtitle: "123 Lakeview Apartments, Unit 4B",
  sections: [
    {
      paragraphs: [
        "Dear Mr. Sharma,",
        "I am writing to follow up on the repair request I submitted on the 3rd of this month regarding the leaking kitchen faucet in Unit 4B. As of today, the issue remains unresolved despite the standard 7-day service window having passed.",
      ],
    },
    {
      heading: "Summary of the issue",
      bullets: [
        "Kitchen faucet has been leaking continuously since March 3rd",
        "Water pooling near the cabinet base, risking damage to the flooring",
        "Reported via the maintenance portal (ticket #4471) with no response",
      ],
    },
    {
      heading: "Requested next steps",
      numbered: [
        "Confirm a technician visit date within the next 3 business days",
        "Send written confirmation once the repair is scheduled",
        "Assess and note any water damage to the cabinet or flooring",
      ],
    },
    {
      heading: "Correspondence timeline",
      table: {
        headers: ["Date", "Action", "Status"],
        rows: [
          ["Mar 3", "Repair request submitted (ticket #4471)", "Logged"],
          ["Mar 5", "Technician visit requested via portal", "Pending"],
          ["Mar 10", "7-day service window expired", "Overdue"],
        ],
      },
    },
    {
      paragraphs: [
        "I would appreciate a response by the end of this week. Please let me know if you need any further information from my end.",
        "Sincerely,\nA. Fernandes",
      ],
    },
  ],
};
