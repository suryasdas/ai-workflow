import { NextResponse } from "next/server";
import { TicketService } from "@/lib/services/ticket-service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const details = await new TicketService().getTicketWithDetails(id);

  if (!details) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json(details);
}
