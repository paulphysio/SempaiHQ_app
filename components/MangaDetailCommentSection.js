import React from 'react';
import CommentThread from './CommentThread';

// Series-level comments (table: manga_detail_comments). Same props as before.
const MangaDetailCommentSection = ({ mangaId, mangaTitle = 'Unknown Manga', isWalletConnected, activePublicKey }) => (
  <CommentThread
    table="manga_detail_comments"
    scope={{ manga_id: mangaId }}
    notifyContext={{ manga_id: mangaId }}
    replyMessage={(name) => `${name} replied to your comment on ${mangaTitle}.`}
    isWalletConnected={isWalletConnected}
    activePublicKey={activePublicKey}
  />
);

export default MangaDetailCommentSection;
