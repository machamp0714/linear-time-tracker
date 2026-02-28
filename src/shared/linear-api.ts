import type { LinearIssueNode, LinearAttachmentNode, LinearAttachmentCreateInput } from './types';

const ENDPOINT = 'https://api.linear.app/graphql';

export class LinearApi {
  constructor(private apiKey: string) {}

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();
    if (!res.ok || json.errors) {
      const msg = json.errors?.[0]?.message || `Linear API error: ${res.status}`;
      throw new Error(msg);
    }
    return json.data as T;
  }

  async getIssueByIdentifier(identifier: string): Promise<LinearIssueNode | null> {
    try {
      const data = await this.graphql<{
        issue: LinearIssueNode;
      }>(
        `query ($id: String!) {
          issue(id: $id) {
            id
            identifier
          }
        }`,
        { id: identifier },
      );
      return data.issue;
    } catch {
      return null;
    }
  }

  async getIssueAttachments(issueId: string): Promise<LinearAttachmentNode[]> {
    const data = await this.graphql<{
      issue: { attachments: { nodes: LinearAttachmentNode[] } };
    }>(
      `query ($issueId: String!) {
        issue(id: $issueId) {
          attachments {
            nodes { id url title subtitle metadata }
          }
        }
      }`,
      { issueId },
    );
    return data.issue.attachments.nodes;
  }

  async createAttachment(
    input: LinearAttachmentCreateInput,
  ): Promise<{ success: boolean; attachment: { id: string; metadata: Record<string, unknown> } }> {
    const data = await this.graphql<{
      attachmentCreate: {
        success: boolean;
        attachment: { id: string; metadata: Record<string, unknown> };
      };
    }>(
      `mutation ($input: AttachmentCreateInput!) {
        attachmentCreate(input: $input) {
          success
          attachment { id metadata }
        }
      }`,
      { input },
    );
    return data.attachmentCreate;
  }
}
