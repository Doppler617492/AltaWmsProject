# Contributing to Alta WMS

Thank you for your interest in contributing to Alta WMS! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment for all contributors.

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check the [issue tracker](https://github.com/Doppler617492/AltaWmsProject/issues) for existing reports
2. Verify the bug exists in the latest version
3. Collect relevant information (error messages, screenshots, logs)

When submitting a bug report, include:
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node version)
- Screenshots or error logs
- Possible solutions (if any)

### Suggesting Features

Feature requests are welcome! Please:
1. Check existing feature requests first
2. Explain the use case and benefit
3. Provide examples or mockups if possible
4. Consider implementation complexity

### Pull Requests

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/AltaWmsProject.git
   cd AltaWmsProject
   ```

2. **Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make Changes**
   - Follow code style guidelines
   - Write/update tests
   - Update documentation
   - Ensure all tests pass

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: add new shipping status tracking"
   ```

5. **Push & Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Development Guidelines

### Code Style

#### TypeScript/JavaScript
- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer `const` over `let`
- Use async/await over promises
- Add JSDoc comments for public APIs

```typescript
/**
 * Assigns a shipping order to a team or worker
 * @param orderId - The shipping order ID
 * @param assigneeIds - Array of user IDs to assign
 * @param teamId - Optional team ID for team assignment
 * @returns Assignment result with status
 */
async assignShippingOrder(
  orderId: number,
  assigneeIds: number[],
  teamId?: number
): Promise<AssignmentResult> {
  // Implementation
}
```

#### React/Next.js
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for props
- Follow naming conventions (PascalCase for components)

```tsx
interface ShippingCardProps {
  order: ShippingOrder;
  onAssign: (orderId: number) => void;
}

export const ShippingCard: React.FC<ShippingCardProps> = ({ 
  order, 
  onAssign 
}) => {
  // Component implementation
};
```

### Testing

#### Unit Tests
```typescript
describe('ShippingService', () => {
  describe('assignOrder', () => {
    it('should assign order to team successfully', async () => {
      // Arrange
      const orderId = 1;
      const teamId = 5;
      
      // Act
      const result = await service.assignOrder(orderId, [], teamId);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.assignedCount).toBeGreaterThan(0);
    });
  });
});
```

#### Integration Tests
```typescript
describe('Shipping API (e2e)', () => {
  it('/shipping/active (GET) should return active orders', () => {
    return request(app.getHttpServer())
      .get('/shipping/active')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(shipping): add store destination tracking

- Added store_name field to shipping orders
- Updated UI to display store in yellow
- Modified Pantheon sync to prioritize Primalac2

Closes #123

fix(workforce): correct team member display in assignment modal

The team assignment modal was not showing all team members.
This fix ensures assigned_summary includes all members.

Fixes #456
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

Examples:
- `feature/shipping-status-tracking`
- `fix/pantheon-sync-503-error`
- `docs/api-documentation`

## Pull Request Process

1. **Update Documentation**
   - Update README if needed
   - Add/update API documentation
   - Update CHANGELOG.md

2. **Run Tests**
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

3. **Create Pull Request**
   - Clear title and description
   - Link related issues
   - Add screenshots for UI changes
   - Request review from maintainers

4. **Review Process**
   - Address review comments
   - Keep PR focused and small
   - Rebase if needed
   - Ensure CI passes

5. **Merge**
   - Squash commits if needed
   - Update branch before merging
   - Delete branch after merge

## Development Setup

See [README.md](./README.md#-installation) for detailed setup instructions.

Quick setup:
```bash
# Install dependencies
npm run install:all

# Start development environment
docker compose up -d db
npm run dev

# Run tests
npm run test
```

## Project Structure

```
backend/src/
├── auth/              # Authentication & authorization
├── shipping/          # Shipping module
├── receiving/         # Receiving module
├── workforce/         # Team management
├── integrations/      # External integrations
├── entities/          # Database entities
└── migrations/        # Database migrations

frontend/
├── components/        # Reusable components
├── pages/            # Next.js pages
├── lib/              # Utilities
└── services/         # API services
```

## Questions?

- Create an issue for general questions
- Tag issues with `question` label
- Check existing documentation first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
