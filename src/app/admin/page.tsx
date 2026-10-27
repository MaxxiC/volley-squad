import { redirect } from "next/navigation";
import { ADMIN_HOME } from "@/auth.config";

export default function AdminIndex() {
  redirect(ADMIN_HOME);
}
