export function smsDelivery(status, reason = "") {
  const normalized = String(status || "queued").toLowerCase();
  if (normalized === "delivered") return { terminal: true, failed: false, label: "Message delivered." };
  if (/fail|reject|undeliver|cancel|expired|delivery_unconfirmed/.test(normalized)) {
    return { terminal: true, failed: true, label: `Delivery failed or could not be confirmed.${reason ? ` ${reason}` : " Check delivery details before retrying."}` };
  }
  return { terminal: false, failed: false, label: "Message submitted to Telnyx. Delivery pending." };
}
