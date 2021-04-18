// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Bicep.Core;
using Bicep.Core.Diagnostics;
using Bicep.Core.Emit;
using Bicep.Core.Parsing;
using Bicep.Core.Resources;
using Bicep.Core.Semantics;
using Bicep.Core.Syntax;
using Bicep.Core.TypeSystem;
using Bicep.LanguageServer.CompilationManager;
using Bicep.LanguageServer.Extensions;
using MediatR;
using Microsoft.Extensions.Logging;
using OmniSharp.Extensions.JsonRpc;
using OmniSharp.Extensions.LanguageServer.Protocol.Models;

namespace Bicep.LanguageServer.Handlers
{
    [Method("textDocument/deploymentGraph", Direction.ClientToServer)]
    public record BicepDeploymentGraphParams(TextDocumentIdentifier TextDocument) : ITextDocumentIdentifierParams, IRequest<BicepDeploymentGraph?>;

    public record BicepDeploymentGraph(IEnumerable<BicepDeploymentGraphNode> Nodes, IEnumerable<BicepDeploymentGraphEdge> Edges, bool HasErrors);

    public record BicepDeploymentGraphNode(string Id, string? ParentId, string SymbolicName, string? ResourceType, string? ModulePath, bool IsCollection, Range Range, bool HasError);

    public record BicepDeploymentGraphEdge(string SourceId, string TargetId);

    public class BicepDeploymentGraphHandler : IJsonRpcRequestHandler<BicepDeploymentGraphParams, BicepDeploymentGraph?>
    {
        private readonly ILogger<BicepDocumentSymbolHandler> logger;
        private readonly ICompilationManager compilationManager;

        public BicepDeploymentGraphHandler(ILogger<BicepDocumentSymbolHandler> logger, ICompilationManager compilationManager)
        {
            this.logger = logger;
            this.compilationManager = compilationManager;
        }

        public Task<BicepDeploymentGraph?> Handle(BicepDeploymentGraphParams request, CancellationToken cancellationToken)
        {
            CompilationContext? context = this.compilationManager.GetCompilation(request.TextDocument.Uri);

            if (context == null)
            {
                this.logger.LogError("Dependency graph request arrived before file {Uri} could be compiled.", request.TextDocument.Uri);

                return Task.FromResult<BicepDeploymentGraph?>(null);
            }

            var graph = CreateDeploymentGraph(context);

            return Task.FromResult<BicepDeploymentGraph?>(graph);
        }

        public static BicepDeploymentGraph CreateDeploymentGraph(CompilationContext context)
        {
            var nodes = new List<BicepDeploymentGraphNode>();
            var edges = new List<BicepDeploymentGraphEdge>();
            var hasError = false;

            var queue = new Queue<(SemanticModel, string?)>();
            var entrySemanticModel = context.Compilation.GetEntrypointSemanticModel();

            queue.Enqueue((entrySemanticModel, null));

            while (queue.Count > 0)
            {
                var (semanticModel, parentId) = queue.Dequeue();
                var nodesBySymbol = new Dictionary<DeclaredSymbol, BicepDeploymentGraphNode>();
                var dependenciesBySymbol = ResourceDependencyVisitor.GetResourceDependencies(semanticModel, true)
                    .Where(x => x.Key.Name != LanguageConstants.MissingName && x.Key.Name != LanguageConstants.ErrorName)
                    .ToImmutableDictionary(x => x.Key, x => x.Value);

                var errors = semanticModel.GetAllDiagnostics().Where(x => x.Level == DiagnosticLevel.Error).ToList();

                if (errors.Count > 0)
                {
                    hasError = true;
                }

                // Create nodes.
                foreach (var symbol in dependenciesBySymbol.Keys)
                {
                    var symbolicName = symbol.Name;
                    var id = parentId is null ? symbolicName : $"{parentId}::{symbolicName}";

                    if (symbol is ResourceSymbol resourceSymbol)
                    {
                        var resourceType = TryGetTypeReference(resourceSymbol)?.FullyQualifiedType ?? "unknown";
                        var isCollection = resourceSymbol.Type is ArrayType { Item: ResourceType };
                        var resourceSpan = resourceSymbol.DeclaringResource.Span;
                        var range = resourceSpan.ToRange(context.LineStarts);
                        var resourceHasError = errors.Any(error => TextSpan.AreOverlapping(resourceSpan, error.Span));

                        nodesBySymbol[symbol] = new BicepDeploymentGraphNode(id, parentId, symbolicName, resourceType, null, isCollection, range, resourceHasError);
                    }

                    if (symbol is ModuleSymbol moduleSymbol)
                    {
                        var modulePath = moduleSymbol.DeclaringModule.TryGetPath()?.TryGetLiteralValue() ?? "unknown";
                        var isCollection = moduleSymbol.Type is ArrayType { Item: ModuleType };
                        var moduleSpan = moduleSymbol.DeclaringModule.Span;
                        var range = moduleSpan.ToRange(context.LineStarts);
                        var moduleHasError = errors.Any(error => TextSpan.AreOverlapping(moduleSpan, error.Span));

                        nodesBySymbol[symbol] = new BicepDeploymentGraphNode(id, parentId, symbolicName, null, modulePath, isCollection, range, moduleHasError);

                        if (moduleSymbol.TryGetSemanticModel(out var moduleSemanticModel, out var _))
                        {
                            queue.Enqueue((moduleSemanticModel, id));
                        }
                    }
                }

                nodes.AddRange(nodesBySymbol.Values);

                // Create edges.
                foreach (var (symbol, dependencies) in dependenciesBySymbol)
                {
                    var source = nodesBySymbol[symbol];

                    foreach (var dependency in dependencies)
                    {
                        var target = nodesBySymbol[dependency.Resource];

                        edges.Add(new BicepDeploymentGraphEdge(source.Id, target.Id));
                    }
                }
            }

            return new BicepDeploymentGraph(
                nodes.OrderBy(node => node.Id),
                edges.OrderBy(edge => $"{edge.SourceId}>{edge.TargetId}"),
                hasError);
        }

        private static ResourceTypeReference? TryGetTypeReference(ResourceSymbol resourceSymbol) => resourceSymbol.Type switch
        {
            ResourceType resourceType => resourceType.TypeReference,
            ArrayType { Item: ResourceType resourceType } => resourceType.TypeReference,
            _ => null
        };
    }
}
