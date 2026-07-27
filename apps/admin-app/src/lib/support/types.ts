import type { TicketStatus, TicketPriority } from "@prisma/client";

export type SupportTicketItem = {
  id: string;
  orgId: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string | null;
  assigneeName: string | null;
  createdBy: string | null;
  creatorName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessageItem = {
  id: string;
  ticketId: string;
  adminId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
};

export type SupportDashboard = {
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  criticalOpen: number;
  unassignedTickets: number;
  avgResolutionHours: number;
  statusBreakdown: { status: string; count: number }[];
  priorityBreakdown: { priority: string; count: number }[];
  recentTickets: SupportTicketItem[];
};
