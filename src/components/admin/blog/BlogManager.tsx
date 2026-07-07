import { useState } from "react";
import BlogList from "./BlogList";
import BlogEditor from "./BlogEditor";

const BlogManager = () => {
  const [editingId, setEditingId] = useState<string | null | "new">(null);

  if (editingId !== null) {
    return (
      <BlogEditor
        postId={editingId === "new" ? null : editingId}
        onDone={() => setEditingId(null)}
      />
    );
  }

  return <BlogList onCreate={() => setEditingId("new")} onEdit={(id) => setEditingId(id)} />;
};

export default BlogManager;
