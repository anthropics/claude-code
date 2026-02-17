# model_alias_mapping.py

class ModelAliasMapping:
    def __init__(self):
        self.alias_map = {}

    def add_alias(self, original_model, alias):
        if original_model not in self.alias_map:
            self.alias_map[original_model] = []
        self.alias_map[original_model].append(alias)

    def get_aliases(self, model):
        return self.alias_map.get(model, [])

    def remove_alias(self, original_model, alias):
        if original_model in self.alias_map:
            self.alias_map[original_model].remove(alias)
            if not self.alias_map[original_model]:
                del self.alias_map[original_model]

    def clear_aliases(self):
        self.alias_map.clear()

# Example usage
if __name__ == "__main__":
    mapping = ModelAliasMapping()
    mapping.add_alias("Claude Sonnet 4.6", "Sonnet")
    print(mapping.get_aliases("Claude Sonnet 4.6"))
    mapping.remove_alias("Claude Sonnet 4.6", "Sonnet")
    print(mapping.get_aliases("Claude Sonnet 4.6"))
    mapping.clear_aliases()
    print(mapping.alias_map)