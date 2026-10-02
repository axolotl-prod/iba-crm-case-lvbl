import { Circle } from "lucide-react";
import { monthLabel } from "@/lib/crm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MonthSelect({
  value,
  months,
  onChange,
}: {
  value: string;
  months: string[];
  onChange: (period: string) => void;
}) {
  const options = months.includes(value) ? months : [value, ...months];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44" aria-label="Выбрать месяц">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((month) => (
          <SelectItem key={month} value={month}>
            <span className="flex items-center gap-2">
              <Circle
                className={`size-2 fill-current ${months.includes(month) ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="capitalize">{monthLabel(month)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}