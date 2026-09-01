import { LeadMutationQueue } from "@/lib/leads/mutation-queue";

describe("LeadMutationQueue", () => {
  it("serializes mutations per lead and ignores stale responses", async () => {
    const queue = new LeadMutationQueue();
    const order: string[] = [];

    const first = queue.enqueue("lead-1", async (version) => {
      order.push("start-1");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("end-1");
      return version;
    });

    const second = queue.enqueue("lead-1", async (version) => {
      order.push("start-2");
      return version;
    });

    const [firstVersion, secondVersion] = await Promise.all([first, second]);

    expect(order).toEqual(["start-1", "end-1", "start-2"]);
    expect(queue.isStale("lead-1", firstVersion)).toBe(true);
    expect(queue.isStale("lead-1", secondVersion)).toBe(false);
  });
});
