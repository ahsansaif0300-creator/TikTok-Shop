import { sendSupportMessage } from "@/lib/actions/support";
import { SERVICE_TOPICS } from "@/lib/service-bot";
import { Button } from "@/components/ui";

export function ServiceComposer({
  merchantId,
  intakeStep,
  status,
}: {
  merchantId?: string;
  intakeStep?: string;
  status?: string;
}) {
  const showTopics = !merchantId && (intakeStep === "welcome" || intakeStep === "topic") && status !== "WITH_AGENT";
  const waiting = status === "WAITING_AGENT";
  const withAgent = status === "WITH_AGENT";

  return (
    <div className="mt-4 space-y-3">
      {showTopics ? (
        <div className="flex flex-wrap gap-2">
          {SERVICE_TOPICS.map((topic) => (
            <form action={sendSupportMessage} key={topic.id}>
              <input type="hidden" name="body" value={topic.label} />
              <Button type="submit" variant="secondary">
                {topic.label}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      {waiting ? (
        <p className="text-sm text-muted">A support team member will continue this chat. You can add more detail below.</p>
      ) : null}
      {withAgent ? <p className="text-sm text-muted">You are chatting with a Harbor support team member.</p> : null}
      <form action={sendSupportMessage} className="space-y-3">
        {merchantId ? <input type="hidden" name="merchantId" value={merchantId} /> : null}
        <textarea
          name="body"
          required
          rows={3}
          placeholder={showTopics ? "Or type your own message" : "Write a message"}
          className="w-full rounded-xl border border-line p-3 text-sm outline-none ring-accent/30 focus:ring-2"
        />
        <Button type="submit">{merchantId ? "Send reply" : "Send message"}</Button>
      </form>
    </div>
  );
}
