// Core no-undef does not inspect JSX component names.
export const jsxBindings = {
  meta: { type: 'problem', schema: [], messages: { missing: 'Componenta {{name}} nu este definită sau importată.' } },
  create(context) {
    return {
      JSXOpeningElement(node) {
        let name = node.name;
        while (name.type === 'JSXMemberExpression') name = name.object;
        if (name.type !== 'JSXIdentifier' || !/^[A-Z]/.test(name.name)) return;
        let scope = context.sourceCode.getScope(node);
        while (scope) {
          if (scope.set.has(name.name)) {
            context.sourceCode.markVariableAsUsed(name.name, node);
            return;
          }
          scope = scope.upper;
        }
        context.report({ node: name, messageId: 'missing', data: { name: name.name } });
      },
    };
  },
};
