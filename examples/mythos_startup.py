from ethos_aegis.veriflow import CKANClient, VeriflowImmuneSystem


def build_mythos(host_url: str, sample_resource_id: str | None = None) -> VeriflowImmuneSystem:
    ckan = CKANClient(host_url)
    immune = VeriflowImmuneSystem(
        ckan,
        probe_on_startup=True,
        sample_resource_id=sample_resource_id,
        fingerprint_mode="auto",
    )
    immune.bootstrap()
    return immune


if __name__ == "__main__":
    mythos = build_mythos("https://demo.ckan.org")
    print(mythos.capability_matrix.to_dict() if mythos.capability_matrix else {})
