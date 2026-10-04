import pytest


@pytest.mark.parametrize(
    ("path", "body"),
    [("/", {"message": "Hello World"}), ("/health", {"status": "healthy"})],
)
def test_public_probe(client, path, body):
    response = client.get(path)
    assert response.status_code == 200
    assert response.json() == body
