import { ROUTES } from "@/constants/routes";
import Link from "next/link";
import styles from "./Breadcrumb.module.css";
// components/Breadcrumb.tsx
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={index} aria-current={index === items.length - 1 ? "page" : undefined}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Usage:
const program = { name: "Example Program" }; // Define the program object

<Breadcrumb
  items={[
    { label: "Heim", href: ROUTES.HOME },
    { label: "Dagskrár", href: ROUTES.PROGRAMS },
    { label: program.name },
  ]}
/>;
