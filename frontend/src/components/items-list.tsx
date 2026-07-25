import { getItems } from "@/services/items/queries/get-items";

export async function ItemsList() {
  const items = await getItems();

  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium">Items List</h2>
      {items.length === 0 ? (
        <div className="mt-4 text-muted">No items yet.</div>
      ) : (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-muted">
          {items.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
