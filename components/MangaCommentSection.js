import React from 'react';
import CommentThread from './CommentThread';

// Chapter-level comments (table: manga_comments). Same props as before.
const MangaCommentSection = ({ mangaId, chapterId, isWalletConnected, activePublicKey }) => (
  <CommentThread
    table="manga_comments"
    scope={{ manga_id: mangaId, chapter_id: chapterId }}
    notifyContext={{ manga_id: mangaId, chapter_id: chapterId }}
    replyMessage={(name) => `${name} replied to your comment.`}
    isWalletConnected={isWalletConnected}
    activePublicKey={activePublicKey}
  />
);

export default MangaCommentSection;
