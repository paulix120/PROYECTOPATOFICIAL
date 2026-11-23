"""
Prueba de carga para RNF-01, RNF-02 y RNF-03.
Con el sistema encendido:
    locust -f tests/locustfile.py --host http://localhost:8000
Abrir http://localhost:8089 y escribir usuarios y velocidad.
"""
from locust import HttpUser, task, between


class Turista(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def ver_servicios(self):
        self.client.get("/servicios/")

    @task(2)
    def ver_hospedajes(self):
        self.client.get("/servicios/hospedajes")

    @task(1)
    def ver_restaurantes(self):
        self.client.get("/servicios/gastronomia/restaurantes")
