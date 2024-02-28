import React from 'react';
import ReactDOM from 'react-dom/client';
import { Comments, CommentsWidgetProps } from './comments.js';

const config: CommentsWidgetProps = {
  api: {
    url: import.meta.env.VITE_API_URL,
  },
  projectId: import.meta.env.VITE_PROJECT_ID,
  resourceId: import.meta.env.VITE_RESOURCE_ID,
  login: {
    label: import.meta.env.VITE_LOGIN_LABEL,
    url: `${import.meta.env.VITE_API_URL}/auth/project/${
      import.meta.env.VITE_PROJECT_ID
    }/login?forceNewLogin=1&useAuth=default&redirectUri=${document.location}`,
  },
  sentiment: import.meta.env.VITE_SENTIMENT,
  emptyListText: import.meta.env.VITE_EMPTY_LIST_TEXT,
  title: import.meta.env.VITE_TITLE,
  descriptionMinLength: import.meta.env.VITE_DESCRIPTION_MIN_LENGTH,
  descriptionMaxLength: import.meta.env.VITE_DESCRIPTION_MAX_LENGTH,
  placeholder: import.meta.env.VITE_PLACEHOLDER,
  formIntro: import.meta.env.VITE_FORM_INTRO,
  commentsIsClosedText: import.meta.env.VITE_COMMENTS_IS_CLOSED_TEXT,
  isVotingEnabled: true,
  isReplyingEnabled: true,
  requiredUserRole: import.meta.env.VITE_REQUIRED_USER_ROLE,
  userNameFields: eval(import.meta.env.VITE_USER_NAME_FIELDS),
  isClosed: import.meta.env.VITE_VOTING_IS_CLOSED,
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Comments {...config} />
  </React.StrictMode>
);
