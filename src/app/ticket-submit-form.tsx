"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

type TicketSubmitFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button" type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
      {pending ? "Analyzing ticket..." : "Submit and analyze"}
    </button>
  );
}

function FormField(props: ComponentProps<"input"> & { label: string }) {
  const { pending } = useFormStatus();
  const { label, ...inputProps } = props;

  return (
    <label>
      {label}
      <input {...inputProps} disabled={pending} />
    </label>
  );
}

function FormTextarea(props: ComponentProps<"textarea"> & { label: string }) {
  const { pending } = useFormStatus();
  const { label, ...textareaProps } = props;

  return (
    <label>
      {label}
      <textarea {...textareaProps} disabled={pending} />
    </label>
  );
}

function PendingOverlay() {
  const { pending } = useFormStatus();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsedMs(0);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pending]);

  if (!pending) {
    return null;
  }

  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="form-overlay" aria-live="polite" aria-busy="true">
      <div className="form-overlay-content">
        <LoaderCircle className="spin" size={28} />
        <strong>AI analysis in progress</strong>
        <span className="elapsed-chip">Elapsed: {elapsedSeconds}s</span>
      </div>
    </div>
  );
}

export function TicketSubmitForm({ action }: TicketSubmitFormProps) {
  return (
    <form action={action} className="panel form-panel form-panel-shell">
      <PendingOverlay />

      <div className="panel-heading">
        <Send size={20} />
        <h2>Submit Ticket</h2>
      </div>

      <FormField
        label="Customer email"
        name="customerEmail"
        type="email"
        required
        placeholder="customer@example.com"
      />

      <FormField
        label="Subject"
        name="subject"
        required
        minLength={3}
        placeholder="Refund for delayed shipment"
      />

      <FormTextarea
        label="Message"
        name="body"
        required
        minLength={10}
        rows={8}
        placeholder="Tell us what happened..."
      />

      <SubmitButton />
    </form>
  );
}
