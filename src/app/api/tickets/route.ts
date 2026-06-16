import { NextResponse } from "next/server";
import { TicketService } from "@/lib/services/ticket-service";

export async function GET() {
  const tickets = await new TicketService().listTickets();
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const body = await request.json();
  const ticket = await new TicketService().submitTicket(body);
  return NextResponse.json({ ticket }, { status: 201 });
}
