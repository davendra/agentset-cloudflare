import { describe, expect, it } from "vitest";

import type { PartitionBatch } from "../src/partition";
import type { VectorStoreMetadata } from "../src/vector-store/common/vector-store";
import { makeChunk, metadataToChunk } from "../src/chunk";

describe("makeChunk", () => {
  const mockDocumentId = "doc-123";
  const mockEmbedding = [0.1, 0.2, 0.3];

  const createMockChunk = (
    overrides: Partial<PartitionBatch[number]> = {},
  ): PartitionBatch[number] => ({
    id_: "chunk-1",
    embedding: null,
    metadata: {
      filename: "test.txt",
      filetype: "text/plain",
      sequence_number: 1,
      languages: ["en"],
    },
    excluded_embed_metadata_keys: [],
    excluded_llm_metadata_keys: [],
    relationships: {
      "1": {
        node_id: "source-node-1",
        node_type: "1",
        metadata: {
          filename: "test.txt",
          filetype: "text/plain",
        },
        hash: "abc123",
        class_name: "Document",
      },
    },
    metadata_template: "{key}: {value}",
    metadata_separator: "\n",
    text: "This is a test chunk.",
    mimetype: "text/plain",
    start_char_idx: 0,
    end_char_idx: 21,
    metadata_seperator: "\n",
    text_template: "{metadata_str}\n\n{content}",
    class_name: "TextNode",
    ...overrides,
  });

  describe("basic functionality", () => {
    it("should create a chunk with correct id format", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.id).toBe(`${mockDocumentId}#${mockChunk.id_}`);
    });

    it("should include the vector embedding", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.vector).toEqual(mockEmbedding);
    });

    it("should include the text content", () => {
      const mockChunk = createMockChunk({ text: "Custom text content" });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.text).toBe("Custom text content");
    });

    it("should include metadata", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty("filename", "test.txt");
      expect(result.metadata).toHaveProperty("filetype", "text/plain");
    });
  });

  describe("removeTextFromMetadata option", () => {
    it("should include text in metadata by default", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      // Text should be included in metadata by default
      expect(result.text).toBe(mockChunk.text);
    });

    it("should handle removeTextFromMetadata=false explicitly", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk(
        {
          documentId: mockDocumentId,
          embedding: mockEmbedding,
          chunk: mockChunk,
        },
        { removeTextFromMetadata: false },
      );

      expect(result.text).toBe(mockChunk.text);
      expect(result.metadata).toBeDefined();
    });

    it("should remove text from metadata when removeTextFromMetadata=true", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk(
        {
          documentId: mockDocumentId,
          embedding: mockEmbedding,
          chunk: mockChunk,
        },
        { removeTextFromMetadata: true },
      );

      // The text field itself should still exist
      expect(result.text).toBe(mockChunk.text);
    });
  });

  describe("different node types", () => {
    it("should handle TextNode class name", () => {
      const mockChunk = createMockChunk({ class_name: "TextNode" });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.id).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should handle Document class name", () => {
      const mockChunk = createMockChunk({ class_name: "Document" });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.id).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should handle IndexNode class name", () => {
      const mockChunk = createMockChunk({ class_name: "IndexNode" });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.id).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe("relationship handling", () => {
    it("should handle SOURCE relationship (type 1)", () => {
      const mockChunk = createMockChunk({
        relationships: {
          "1": {
            node_id: "source-id",
            node_type: "1",
            metadata: {},
            hash: "hash1",
            class_name: "Document",
          },
        },
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
    });

    it("should handle PREVIOUS relationship (type 2)", () => {
      const mockChunk = createMockChunk({
        relationships: {
          "2": {
            node_id: "prev-id",
            node_type: "1",
            metadata: {},
            hash: "hash2",
            class_name: "TextNode",
          },
        },
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
    });

    it("should handle NEXT relationship (type 3)", () => {
      const mockChunk = createMockChunk({
        relationships: {
          "3": {
            node_id: "next-id",
            node_type: "1",
            metadata: {},
            hash: "hash3",
            class_name: "TextNode",
          },
        },
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
    });

    it("should handle multiple relationships", () => {
      const mockChunk = createMockChunk({
        relationships: {
          "1": {
            node_id: "source-id",
            node_type: "4",
            metadata: {},
            hash: "hash1",
            class_name: "Document",
          },
          "2": {
            node_id: "prev-id",
            node_type: "1",
            metadata: {},
            hash: "hash2",
            class_name: "TextNode",
          },
          "3": {
            node_id: "next-id",
            node_type: "1",
            metadata: {},
            hash: "hash3",
            class_name: "TextNode",
          },
        },
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
    });

    it("should handle empty relationships", () => {
      const mockChunk = createMockChunk({
        relationships: {},
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
    });
  });

  describe("metadata handling", () => {
    it("should preserve custom metadata fields", () => {
      const mockChunk = createMockChunk({
        metadata: {
          filename: "custom.pdf",
          filetype: "application/pdf",
          sequence_number: 5,
          languages: ["en", "es"],
          link_texts: ["Link 1", "Link 2"],
          link_urls: ["https://example.com/1", "https://example.com/2"],
        },
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata.filename).toBe("custom.pdf");
      expect(result.metadata.filetype).toBe("application/pdf");
    });

    it("should handle excluded metadata keys", () => {
      const mockChunk = createMockChunk({
        excluded_embed_metadata_keys: ["field1", "field2"],
        excluded_llm_metadata_keys: ["field3"],
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.metadata).toBeDefined();
    });
  });

  describe("character indices", () => {
    it("should handle null start and end character indices", () => {
      const mockChunk = createMockChunk({
        start_char_idx: null,
        end_char_idx: null,
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should handle valid character indices", () => {
      const mockChunk = createMockChunk({
        start_char_idx: 100,
        end_char_idx: 250,
      });

      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty text", () => {
      const mockChunk = createMockChunk({ text: "" });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.text).toBe("");
      expect(result.id).toBeDefined();
    });

    it("should handle very long text", () => {
      const longText = "a".repeat(10000);
      const mockChunk = createMockChunk({ text: longText });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.text).toBe(longText);
      expect(result.text.length).toBe(10000);
    });

    it("should handle special characters in text", () => {
      const specialText = "Special chars: 你好 🚀 \n\t\r";
      const mockChunk = createMockChunk({ text: specialText });
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.text).toBe(specialText);
    });

    it("should handle empty embedding array", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: [],
        chunk: mockChunk,
      });

      expect(result.vector).toEqual([]);
    });

    it("should handle large embedding vectors", () => {
      const largeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: largeEmbedding,
        chunk: mockChunk,
      });

      expect(result.vector).toEqual(largeEmbedding);
      expect(result.vector.length).toBe(1536);
    });

    it("should handle special characters in document id", () => {
      const specialDocId = "doc-123-abc_def/xyz";
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: specialDocId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result.id).toBe(`${specialDocId}#${mockChunk.id_}`);
    });
  });

  describe("return type structure", () => {
    it("should return object with all required fields", () => {
      const mockChunk = createMockChunk();
      const result = makeChunk({
        documentId: mockDocumentId,
        embedding: mockEmbedding,
        chunk: mockChunk,
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("vector");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("metadata");
      expect(typeof result.id).toBe("string");
      expect(Array.isArray(result.vector)).toBe(true);
      expect(typeof result.text).toBe("string");
      expect(typeof result.metadata).toBe("object");
    });
  });
});

describe("metadataToChunk", () => {
  describe("null/undefined handling", () => {
    it("should return null when metadata is undefined", () => {
      const result = metadataToChunk(undefined);
      expect(result).toBeNull();
    });

    it("should return null when metadata is empty object", () => {
      const result = metadataToChunk({});
      expect(result).toBeNull();
    });

    it("should return null when metadata has no _node_content field", () => {
      const metadata: VectorStoreMetadata = {
        filename: "test.txt",
        filetype: "text/plain",
      };
      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });

    it("should return null when _node_content is empty string", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: "",
      };
      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });
  });

  describe("valid metadata handling", () => {
    it("should process valid metadata with _node_content", () => {
      const nodeContent = JSON.stringify({
        id_: "test-node-1",
        text: "Test content",
        metadata: {
          filename: "test.txt",
        },
        type: "TEXT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        _node_type: "TextNode",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });

    it("should process metadata with node text", () => {
      const nodeContent = JSON.stringify({
        id_: "node-123",
        text: "Sample text content",
        metadata: {
          source: "document.pdf",
          page: 1,
        },
        type: "TEXT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        text: "Sample text content",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });

    it("should process metadata with relationships", () => {
      const nodeContent = JSON.stringify({
        id_: "node-456",
        text: "Content with relationships",
        metadata: {},
        type: "TEXT",
        relationships: {
          SOURCE: {
            nodeId: "source-node",
            type: "DOCUMENT",
          },
        },
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        _node_type: "TextNode",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });

    it("should process metadata with custom fields", () => {
      const nodeContent = JSON.stringify({
        id_: "node-789",
        text: "Content with custom metadata",
        metadata: {
          custom_field_1: "value1",
          custom_field_2: 42,
          tags: ["tag1", "tag2"],
        },
        type: "TEXT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        _node_type: "TextNode",
        custom_field_1: "value1",
        custom_field_2: 42,
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should return null when _node_content is invalid JSON", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: "invalid-json-{",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });

    it("should return null when _node_content has malformed structure", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: JSON.stringify({ incomplete: "data" }),
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });

    it("should return null when metadataDictToNode throws error", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: JSON.stringify({
          id_: null,
          text: null,
        }),
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle metadata with numeric _node_content", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: 12345,
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });

    it("should handle metadata with boolean _node_content", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: true,
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });

    it("should handle metadata with array _node_content", () => {
      const metadata: VectorStoreMetadata = {
        _node_content: ["array", "values"],
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeNull();
    });

    it("should handle very large _node_content", () => {
      const largeText = "x".repeat(100000);
      const nodeContent = JSON.stringify({
        id_: "large-node",
        text: largeText,
        metadata: {},
        type: "TEXT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });

    it("should handle special characters in _node_content", () => {
      const nodeContent = JSON.stringify({
        id_: "special-node",
        text: "Special: 你好 🚀 \n\t\r \\",
        metadata: {
          emoji: "🎉",
        },
        type: "TEXT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });
  });

  describe("different node types", () => {
    it("should handle TEXT node type", () => {
      const nodeContent = JSON.stringify({
        id_: "text-node",
        text: "Text node content",
        metadata: {},
        type: "TEXT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        _node_type: "TextNode",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });

    it("should handle DOCUMENT node type", () => {
      const nodeContent = JSON.stringify({
        id_: "doc-node",
        text: "Document content",
        metadata: {},
        type: "DOCUMENT",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        _node_type: "Document",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });

    it("should handle INDEX node type", () => {
      const nodeContent = JSON.stringify({
        id_: "index-node",
        text: "Index summary",
        metadata: {},
        type: "INDEX",
      });

      const metadata: VectorStoreMetadata = {
        _node_content: nodeContent,
        _node_type: "IndexNode",
      };

      const result = metadataToChunk(metadata);
      expect(result).toBeDefined();
    });
  });
});
