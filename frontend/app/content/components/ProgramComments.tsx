"use client";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

interface ProgramCommentsProps {
  programId: string;
  comments?: Comment[];
}

export default function ProgramComments({ comments = [] }: ProgramCommentsProps) {
  return (
    <div className="program-comments">
      <h3>Comments ({comments.length})</h3>

      {/* Comment form placeholder */}
      <form className="comment-form">
        <textarea placeholder="Add a comment..." rows={3} />
        <button type="submit">Post Comment</button>
      </form>

      {/* Comment list */}
      <div className="comment-list">
        {comments.length === 0 ? (
          <p>No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment">
              <div className="comment-header">
                <strong>{comment.user.name}</strong>
                <time>{comment.createdAt}</time>
              </div>
              <p>{comment.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
