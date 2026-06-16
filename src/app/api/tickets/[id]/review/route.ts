import { NextResponse } from "next/server";
import { TicketService } from "@/lib/services/ticket-service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const review = await new TicketService().reviewTicket({
    ...body,
    ticketId: id,
  });

  return NextResponse.json({ review }, { status: 201 });
}
