import { getCalApi } from "@calcom/embed-react";

let calPromise: ReturnType<typeof getCalApi> | undefined;
export const getCal = async () => {
  if (!calPromise) {
    calPromise = getCalApi({ namespace: "demo" }).then((cal) => {
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
      return cal;
    });
  }

  return calPromise;
};
