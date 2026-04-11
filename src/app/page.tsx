import styles from "./page.module.css";
import { StructuralCopilotWorkbench } from "@/features/structural-copilot";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <StructuralCopilotWorkbench />
      </main>
    </div>
  );
}
