/**
 * Verificación en dos pasos y cifrado en reposo.
 *
 * Tres bloques, de dentro hacia fuera:
 *
 *  1. TOTP contra los vectores de la RFC 6238. Un TOTP escrito a mano solo vale
 *     si genera lo mismo que genera el teléfono; comprobarlo contra uno mismo no
 *     demuestra nada.
 *  2. El sobre de cifrado: ida y vuelta, y sobre todo que un texto manipulado
 *     **falla** en vez de devolver algo distinto en silencio.
 *  3. El recorrido real contra la base: alta, confirmación, reto de login,
 *     código repetido, código de recuperación de un solo uso y límite de
 *     intentos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/prisma.js';
import { hashPassword } from '../server/authService.js';
import { cifrar, descifrar, descifrarSiHaceFalta, estaCifrado } from '../server/crypto.js';
import {
  calcularCodigo,
  codificarBase32,
  construirUriOtpauth,
  decodificarBase32,
  pasoActual,
  verificarCodigo,
} from '../server/totp.js';
import {
  activar,
  crearReto,
  desactivar,
  estadoDeUsuario,
  iniciarConfiguracion,
  regenerarCodigos,
  resolverReto,
} from '../server/twoFactorService.js';

const CORREO_PRUEBA = 'dos-factores@docentos.test';
const CONTRASENA = 'UnaContrasenaLargaDePrueba2026!';

/** El secreto de los vectores de la RFC 6238: los ASCII "12345678901234567890". */
const SECRETO_RFC = codificarBase32(Buffer.from('12345678901234567890', 'ascii'));

function peticionFalsa(): any {
  return {
    ip: '127.0.0.1',
    get(nombre: string) {
      return nombre.toLowerCase() === 'user-agent' ? 'DocentOS TestRunner/1.0' : undefined;
    },
  };
}

test('TOTP: coincide con los vectores de la RFC 6238', async (t) => {
  await t.test('1. base32 va y vuelve sin perder nada', () => {
    const original = Buffer.from('12345678901234567890', 'ascii');
    assert.equal(decodificarBase32(codificarBase32(original)).toString('ascii'), '12345678901234567890');
  });

  await t.test('2. base32 tolera espacios, minúsculas y relleno', () => {
    const conRuido = SECRETO_RFC.toLowerCase().replace(/(.{4})/g, '$1 ') + '==';
    assert.deepEqual(decodificarBase32(conRuido), decodificarBase32(SECRETO_RFC));
  });

  await t.test('3. los seis dígitos de cada instante de la norma', () => {
    // Valores de la RFC 6238 (apéndice B) truncados a seis dígitos, que es lo
    // que enseña la aplicación del teléfono.
    const esperado: Array<[number, string]> = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
    ];
    for (const [segundos, codigo] of esperado) {
      const paso = Math.floor(segundos / 30);
      assert.equal(calcularCodigo(SECRETO_RFC, paso), codigo, `instante ${segundos}`);
    }
  });

  await t.test('4. la ventana acepta el paso anterior y el siguiente, no el de más allá', () => {
    const ahoraMs = 1111111109 * 1000;
    const pasoAnterior = pasoActual(ahoraMs) - 1;
    const codigoAnterior = calcularCodigo(SECRETO_RFC, pasoAnterior);
    assert.equal(verificarCodigo(SECRETO_RFC, codigoAnterior, { ahoraMs }), pasoAnterior);

    const codigoLejano = calcularCodigo(SECRETO_RFC, pasoActual(ahoraMs) - 3);
    assert.equal(verificarCodigo(SECRETO_RFC, codigoLejano, { ahoraMs }), null);
  });

  await t.test('5. lo que no son seis dígitos se rechaza sin calcular nada', () => {
    assert.equal(verificarCodigo(SECRETO_RFC, 'abcdef'), null);
    assert.equal(verificarCodigo(SECRETO_RFC, '12345'), null);
    assert.equal(verificarCodigo(SECRETO_RFC, ''), null);
  });

  await t.test('6. la URI otpauth lleva emisor, algoritmo, dígitos y periodo', () => {
    const uri = construirUriOtpauth({ secreto: SECRETO_RFC, cuenta: 'ana@docentos.test', emisor: 'DocentOS' });
    assert.ok(uri.startsWith('otpauth://totp/DocentOS:ana%40docentos.test?'));
    const parametros = new URLSearchParams(uri.split('?')[1]);
    assert.equal(parametros.get('secret'), SECRETO_RFC);
    assert.equal(parametros.get('issuer'), 'DocentOS');
    assert.equal(parametros.get('algorithm'), 'SHA1');
    assert.equal(parametros.get('digits'), '6');
    assert.equal(parametros.get('period'), '30');
  });
});

test('Cifrado en reposo: sobre AES-256-GCM', async (t) => {
  await t.test('1. ida y vuelta', () => {
    const sobre = cifrar('https://discord.com/api/webhooks/secreto');
    assert.ok(estaCifrado(sobre));
    assert.equal(descifrar(sobre), 'https://discord.com/api/webhooks/secreto');
  });

  await t.test('2. el texto cifrado no contiene el original ni se repite entre llamadas', () => {
    const uno = cifrar('clave-de-api-123');
    const otro = cifrar('clave-de-api-123');
    assert.notEqual(uno, otro, 'cada cifrado usa un vector de inicialización nuevo');
    assert.ok(!uno.includes('clave-de-api-123'));
  });

  await t.test('3. manipular el texto cifrado hace fallar el descifrado, no devolver basura', () => {
    const sobre = cifrar('valor original');
    const partes = sobre.split(':');
    const cuerpo = Buffer.from(partes[4], 'base64');
    cuerpo[0] ^= 0xff;
    partes[4] = cuerpo.toString('base64');
    assert.throws(() => descifrar(partes.join(':')));
  });

  await t.test('4. lo que venía en claro se sigue leyendo (filas anteriores al cifrado)', () => {
    assert.equal(descifrarSiHaceFalta('{"webhookUrl":""}'), '{"webhookUrl":""}');
    assert.equal(descifrarSiHaceFalta(cifrar('{"a":1}')), '{"a":1}');
  });
});

test('Verificación en dos pasos: alta, login y recuperación', async (t) => {
  await prisma.user.deleteMany({ where: { email: CORREO_PRUEBA } });
  const usuario = await prisma.user.create({
    data: {
      email: CORREO_PRUEBA,
      name: 'Cuenta de prueba de dos factores',
      passwordHash: await hashPassword(CONTRASENA),
      role: 'PUBLIC_USER',
    },
  });

  let secreto = '';

  await t.test('1. al empezar, la cuenta no tiene segundo factor', async () => {
    const estado = await estadoDeUsuario(usuario.id);
    assert.equal(estado.activo, false);
    assert.equal(estado.configuracionPendiente, false);
  });

  await t.test('2. el alta guarda el secreto cifrado, nunca en claro', async () => {
    const alta = await iniciarConfiguracion(usuario.id);
    secreto = alta.secreto;
    assert.ok(alta.qr.startsWith('data:image/png;base64,'), 'el QR viaja como imagen embebida');

    const fila = await prisma.user.findUnique({
      where: { id: usuario.id },
      select: { twoFactorSecret: true, twoFactorEnabledAt: true },
    });
    assert.ok(estaCifrado(fila!.twoFactorSecret!), 'el secreto está cifrado en la base');
    assert.ok(!fila!.twoFactorSecret!.includes(secreto), 'el secreto no aparece en claro');
    assert.equal(fila!.twoFactorEnabledAt, null, 'un secreto sin confirmar no activa nada');

    const estado = await estadoDeUsuario(usuario.id);
    assert.equal(estado.activo, false);
    assert.equal(estado.configuracionPendiente, true);
  });

  await t.test('3. un código equivocado no activa nada', async () => {
    assert.equal(await activar(usuario.id, '000000'), null);
    const estado = await estadoDeUsuario(usuario.id);
    assert.equal(estado.activo, false);
  });

  let codigosRecuperacion: string[] = [];

  await t.test('4. el código correcto activa y entrega diez códigos de recuperación', async () => {
    const resultado = await activar(usuario.id, calcularCodigo(secreto, pasoActual()));
    assert.ok(resultado, 'el código de la aplicación debe valer');
    codigosRecuperacion = resultado!.codigos;
    assert.equal(codigosRecuperacion.length, 10);

    const estado = await estadoDeUsuario(usuario.id);
    assert.equal(estado.activo, true);
    assert.equal(estado.codigosDisponibles, 10);
  });

  await t.test('5. los códigos de recuperación se guardan hasheados', async () => {
    const filas = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: usuario.id } });
    assert.equal(filas.length, 10);
    for (const fila of filas) {
      assert.match(fila.codeHash, /^[0-9a-f]{64}$/, 'debe ser un sha256 en hexadecimal');
      assert.ok(!codigosRecuperacion.includes(fila.codeHash));
    }
  });

  /**
   * Olvida el último paso aceptado.
   *
   * Activar consume el intervalo en curso, así que dentro de los mismos treinta
   * segundos ningún código vale: es justo lo que comprueba la prueba 7. Para las
   * que necesitan un inicio de sesión limpio se simula aquí el paso del tiempo,
   * que es más honesto que esperar medio minuto de reloj en cada ejecución.
   */
  const simularQuePasoElTiempo = () =>
    prisma.user.update({ where: { id: usuario.id }, data: { twoFactorLastStep: null } });

  await t.test('6. el reto del login se cierra con el código de la aplicación', async () => {
    await simularQuePasoElTiempo();
    const { token } = await crearReto(usuario.id, peticionFalsa());
    const resultado = await resolverReto(token, calcularCodigo(secreto, pasoActual()), peticionFalsa());
    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.estado === 'ok' && resultado.via, 'totp');
  });

  await t.test('7. el mismo código no vale dos veces, aunque siga vigente', async () => {
    const { token } = await crearReto(usuario.id, peticionFalsa());
    const resultado = await resolverReto(token, calcularCodigo(secreto, pasoActual()), peticionFalsa());
    assert.equal(resultado.estado, 'codigo-invalido', 'el paso ya consumido queda registrado');
  });

  await t.test('8. un reto ya usado no se puede volver a presentar', async () => {
    await simularQuePasoElTiempo();
    const { token } = await crearReto(usuario.id, peticionFalsa());
    const codigo = calcularCodigo(secreto, pasoActual());
    const primero = await resolverReto(token, codigo, peticionFalsa());
    assert.equal(primero.estado, 'ok');
    const segundo = await resolverReto(token, codigo, peticionFalsa());
    assert.equal(segundo.estado, 'reto-invalido');
  });

  await t.test('9. un código de recuperación entra una vez y solo una', async () => {
    const codigo = codigosRecuperacion[0];

    const primero = await resolverReto((await crearReto(usuario.id, peticionFalsa())).token, codigo, peticionFalsa());
    assert.equal(primero.estado, 'ok');
    assert.equal(primero.estado === 'ok' && primero.via, 'recuperacion');

    const segundo = await resolverReto((await crearReto(usuario.id, peticionFalsa())).token, codigo, peticionFalsa());
    assert.equal(segundo.estado, 'codigo-invalido', 'ya estaba gastado');

    assert.equal((await estadoDeUsuario(usuario.id)).codigosDisponibles, 9);
  });

  await t.test('10. el reto se agota tras cinco intentos fallidos', async () => {
    const { token } = await crearReto(usuario.id, peticionFalsa());
    for (let intento = 0; intento < 5; intento += 1) {
      const fallido = await resolverReto(token, '000000', peticionFalsa());
      assert.equal(fallido.estado, 'codigo-invalido', `intento ${intento + 1}`);
    }
    const agotado = await resolverReto(token, '000000', peticionFalsa());
    assert.equal(agotado.estado, 'sin-intentos');
  });

  await t.test('11. un reto caducado no sirve', async () => {
    const { token, reto } = await crearReto(usuario.id, peticionFalsa());
    await prisma.twoFactorChallenge.update({
      where: { id: reto.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const resultado = await resolverReto(token, calcularCodigo(secreto, pasoActual()), peticionFalsa());
    assert.equal(resultado.estado, 'reto-invalido');
  });

  await t.test('12. renovar los códigos invalida los anteriores', async () => {
    const anteriores = [...codigosRecuperacion];
    const nuevos = await regenerarCodigos(usuario.id);
    assert.equal(nuevos.length, 10);

    const conViejo = await resolverReto(
      (await crearReto(usuario.id, peticionFalsa())).token,
      anteriores[5],
      peticionFalsa(),
    );
    assert.equal(conViejo.estado, 'codigo-invalido');
    assert.equal((await estadoDeUsuario(usuario.id)).codigosDisponibles, 10);
  });

  await t.test('13. desactivar borra secreto, códigos y retos', async () => {
    await desactivar(usuario.id);
    const fila = await prisma.user.findUnique({
      where: { id: usuario.id },
      select: { twoFactorSecret: true, twoFactorEnabledAt: true, twoFactorLastStep: true },
    });
    assert.equal(fila!.twoFactorSecret, null);
    assert.equal(fila!.twoFactorEnabledAt, null);
    assert.equal(fila!.twoFactorLastStep, null);
    assert.equal(await prisma.twoFactorRecoveryCode.count({ where: { userId: usuario.id } }), 0);
    assert.equal(await prisma.twoFactorChallenge.count({ where: { userId: usuario.id } }), 0);
  });

  await prisma.user.deleteMany({ where: { email: CORREO_PRUEBA } });
});
