import { loadWidget } from '@openstad-headless/lib/load-widget';
import '@utrecht/component-library-css';
import '@utrecht/design-tokens/dist/root.css';
import { Paragraph, ButtonLink } from '@utrecht/component-library-react';
import React from 'react';
import './counter.css';
import DataStore from '@openstad-headless/data-store/src';
import { BaseProps } from '../../types/base-props';
import { ProjectSettingProps } from '../../types/project-setting-props';

export type CounterWidgetProps = BaseProps &
  CounterProps &
  ProjectSettingProps & {
    resourceId?: string;
  };

export type CounterProps = {
  counterType:
    | 'resource'
    | 'vote'
    | 'votedUsers'
    | 'static'
    | 'argument'
    | 'submission';
  label?: string;
  url?: string;
  opinion?: string;
  amount?: number;
  choiceGuideId?: string;
};

function Counter({
  counterType = 'resource',
  label = 'Hoeveelheid',
  url = '',
  opinion = '',
  amount = 0,
  ...props
}: CounterWidgetProps) {
  let amountDisplayed = 0;
  const urlParams = new URLSearchParams(window.location.search);
  const resourceId =
    urlParams.get('openstadResourceId') || props.resourceId || '';

  const datastore: any = new DataStore({
    projectId: props.projectId,
    api: props.api,
  });

  const { data: resources } = datastore.useResources({
    projectId: counterType === 'resource' ? props.projectId: undefined,
  });

  const { data: resource } = datastore.useResource({
    projectId: props.projectId,
    resourceId,
  });

  const { data: comments } = datastore.useComments({
    projectId: props.projectId,
    resourceId: counterType === 'argument' ? resourceId : undefined,
    sentiment: opinion,
  });

  const {
    data: results,
    error,
    isLoading,
  } = datastore.useChoiceGuideResults({
    projectId: props.projectId,
    choiceGuideId:
      counterType === 'submission' ? props.choiceGuideId : undefined,
  });

  if (counterType === 'resource') {
    amountDisplayed = resources?.metadata?.totalCount || 0;
  }

  if (counterType === 'vote') {
    if (opinion === 'for') {
      amountDisplayed = resource.yes || 0;
    } else if (opinion === 'against') {
      amountDisplayed = resource.no || 0;
    } else {
      amountDisplayed = (resource.yes || 0) + (resource.no || 0);
    }
  }

  if (counterType === 'votedUsers') {
    amountDisplayed = (resource.yes || 0) + (resource.no || 0);
  }

  if (counterType === 'static') {
    amountDisplayed = amount;
  }

  if (counterType === 'argument') {
    amountDisplayed = comments?.length || 0;
  }

  if (counterType === 'submission') {
    amountDisplayed = results?.length || 0;
  }

  const content = () => {
    return (
      <Paragraph>
        {label ? <span className="label">{label}:</span> : null}
        <span className="amount">{amountDisplayed}</span>
      </Paragraph>
    );
  };
  return url.length > 0 ? (
    <ButtonLink
      appearance="secondary-action-button"
      className="osc counter-container --link"
      href={url}>
      {content()}
    </ButtonLink>
  ) : (
    <div className="osc counter-container">
      <>{content()}</>
    </div>
  );
}

Counter.loadWidget = loadWidget;
export { Counter };
