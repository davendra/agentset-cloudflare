import { useEffect } from "react";
import { getCal } from "@/lib/cal";

export function useCal() {
  useEffect(() => {
    void getCal();
  }, []);

  return {
    buttonProps: {
      "data-cal-namespace": "demo",
      "data-cal-link": "agentset/demo",
      "data-cal-config": '{"layout":"month_view"}',
    },
  };
}
