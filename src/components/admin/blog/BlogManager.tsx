import { useState } from "react";
import BlogList from "./BlogList";
import BlogEditor from "./BlogEditor";
import BulkCoverUpload from "./BulkCoverUpload";

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

  return (
    <div className="space-y-6">
      <BulkCoverUpload />
      <BlogList onCreate={() => setEditingId("new")} onEdit={(id) => setEditingId(id)} />
    </div>
  );
};

export default BlogManager;
